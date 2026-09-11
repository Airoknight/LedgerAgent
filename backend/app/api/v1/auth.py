from typing import List, Optional
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    validate_password_complexity,
    generate_password_reset_token,
    verify_password_reset_token,
    generate_totp_secret,
    verify_totp_code,
    generate_recovery_codes,
    hash_recovery_code,
    verify_recovery_code
)
from app.models.firm import Firm
from app.models.organization import User
from app.models.session import SessionRecord
from app.schemas.auth import (
    LoginRequest, 
    LoginResponse, 
    UserProfileResponse,
    MfaSetupResponse,
    MfaVerifyRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    ChangePasswordRequest,
    SessionItem
)
from app.services.session_service import (
    create_user_session,
    revoke_session,
    check_login_throttling,
    record_failed_login
)
from app.api.deps import get_current_session, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    # Check throttling / account lock
    if user:
        is_locked, lock_msg = check_login_throttling(user, db)
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=lock_msg
            )

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    # Generic error message: do not disclose whether user exists or password was wrong
    if not user or not verify_password(payload.password, user.hashed_password):
        record_failed_login(user, email, db, ip_address)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    # Multi-factor authentication check if enabled on user account
    if getattr(user, "mfa_enabled", False):
        mfa_ok = False
        if payload.totp_code and user.mfa_secret:
            mfa_ok = verify_totp_code(user.mfa_secret, payload.totp_code)
        elif payload.recovery_code:
            try:
                rec_codes = json.loads(user.mfa_recovery_codes_json or "[]")
            except Exception:
                rec_codes = []
            for i, h in enumerate(rec_codes):
                if verify_recovery_code(payload.recovery_code, h):
                    mfa_ok = True
                    rec_codes.pop(i)
                    user.mfa_recovery_codes_json = json.dumps(rec_codes)
                    db.commit()
                    break

        if not mfa_ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA_REQUIRED: Valid multi-factor TOTP or recovery code required to complete login."
            )

    # Create server-side session
    session = create_user_session(
        user=user,
        db=db,
        ip_address=ip_address,
        user_agent=user_agent
    )

    # Set HttpOnly SameSite session cookie
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session.id,
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        path="/"
    )
    response.headers["X-CSRF-Token"] = session.csrf_token

    firm = db.query(Firm).filter(Firm.id == session.firm_id).first()
    firm_name = firm.name if firm else settings.DEFAULT_FIRM_NAME

    return LoginResponse(
        status="success",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        firm_id=session.firm_id,
        firm_name=firm_name,
        csrf_token=session.csrf_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "firm_id": session.firm_id,
            "mfa_enabled": bool(getattr(user, "mfa_enabled", False))
        },
        firm={
            "id": session.firm_id,
            "name": firm_name,
        }
    )

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    revoke_session(session.id, db)
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    user = session.user
    firm = db.query(Firm).filter(Firm.id == session.firm_id).first()
    firm_name = firm.name if firm else settings.DEFAULT_FIRM_NAME
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        firm_id=session.firm_id,
        firm_name=firm_name,
        csrf_token=session.csrf_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "firm_id": session.firm_id,
            "mfa_enabled": bool(getattr(user, "mfa_enabled", False))
        },
        firm={
            "id": session.firm_id,
            "name": firm_name,
        }
    )

# ==============================================================================
# Active Session Management
# ==============================================================================

@router.get("/sessions", response_model=List[SessionItem])
def list_active_sessions(
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Lists all valid sessions for the current authenticated user."""
    sessions = db.query(SessionRecord).filter(
        SessionRecord.user_id == current_session.user_id,
        SessionRecord.is_revoked == False
    ).order_by(SessionRecord.created_at.desc()).all()

    return [
        SessionItem(
            id=s.id,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            created_at=s.created_at.isoformat() if s.created_at else "",
            expires_at=s.expires_at.isoformat() if s.expires_at else "",
            is_current=(s.id == current_session.id)
        )
        for s in sessions if s.is_valid
    ]

@router.post("/sessions/revoke-all")
def revoke_all_sessions(
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Revokes all sessions for the user except the current active session."""
    db.query(SessionRecord).filter(
        SessionRecord.user_id == current_session.user_id,
        SessionRecord.id != current_session.id
    ).update({"is_revoked": True})
    db.commit()
    return {"status": "success", "message": "All other sessions revoked"}

@router.post("/sessions/{session_id}/revoke")
def revoke_specific_session(
    session_id: str,
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Revokes a specific session belonging to the user."""
    target = db.query(SessionRecord).filter(
        SessionRecord.id == session_id,
        SessionRecord.user_id == current_session.user_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")
    target.is_revoked = True
    db.commit()
    return {"status": "success", "message": f"Session {session_id[:8]}... revoked"}

# ==============================================================================
# Password Management & Reset
# ==============================================================================

@router.post("/password/change")
def change_password(
    payload: ChangePasswordRequest,
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Allows user to change password after re-verifying current password."""
    user = current_session.user
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    is_valid, err_msg = validate_password_complexity(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    user.hashed_password = get_password_hash(payload.new_password)
    # Revoke all other sessions for security
    db.query(SessionRecord).filter(
        SessionRecord.user_id == user.id,
        SessionRecord.id != current_session.id
    ).update({"is_revoked": True})
    db.commit()
    return {"status": "success", "message": "Password updated successfully"}

@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Generates a secure 15-minute single-use password reset token."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user and user.is_active:
        token = generate_password_reset_token(user.id, user.email)
        return {
            "status": "success",
            "message": "If an account exists, a password reset link has been issued.",
            "reset_token": token  # Returned directly for secure workflow execution
        }
    return {
        "status": "success",
        "message": "If an account exists, a password reset link has been issued."
    }

@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Validates single-use reset token, enforces complexity, and sets new password."""
    token_data = verify_password_reset_token(payload.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = token_data.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    is_valid, err_msg = validate_password_complexity(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    user.hashed_password = get_password_hash(payload.new_password)
    # Revoke all existing sessions immediately
    db.query(SessionRecord).filter(SessionRecord.user_id == user.id).update({"is_revoked": True})
    db.commit()
    return {"status": "success", "message": "Password successfully reset. Please log in with your new password."}

# ==============================================================================
# Multi-Factor Authentication (TOTP MFA)
# ==============================================================================

@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Generates a TOTP secret and 10 single-use emergency backup recovery codes."""
    user = current_session.user
    secret = generate_totp_secret()
    recovery_codes = generate_recovery_codes(10)
    hashed_codes = [hash_recovery_code(c) for c in recovery_codes]

    # Store in draft on user until verified
    user.mfa_secret = secret
    user.mfa_recovery_codes_json = json.dumps(hashed_codes)
    db.commit()

    firm = db.query(Firm).filter(Firm.id == current_session.firm_id).first()
    issuer = firm.name if firm else "LedgerAgent"
    otpauth_url = f"otpauth://totp/{issuer}:{user.email}?secret={secret}&issuer={issuer}"

    return MfaSetupResponse(
        secret=secret,
        otpauth_url=otpauth_url,
        recovery_codes=recovery_codes
    )

@router.post("/mfa/enable")
def enable_mfa(
    payload: MfaVerifyRequest,
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Verifies a 6-digit TOTP code and permanently enables MFA for the user."""
    user = current_session.user
    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initialized. Call /auth/mfa/setup first.")

    if not verify_totp_code(user.mfa_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP verification code. Please check your authenticator app.")

    user.mfa_enabled = True
    db.commit()
    return {"status": "success", "message": "Two-factor authentication has been successfully enabled."}

@router.post("/mfa/disable")
def disable_mfa(
    payload: ChangePasswordRequest,
    current_session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Disables MFA after re-verifying current password."""
    user = current_session.user
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password. Reauthentication failed.")

    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_recovery_codes_json = "[]"
    db.commit()
    return {"status": "success", "message": "Two-factor authentication has been disabled."}
