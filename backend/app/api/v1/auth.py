from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password
from app.models.firm import Firm
from app.models.organization import User
from app.models.session import SessionRecord
from app.schemas.auth import LoginRequest, LoginResponse, UserProfileResponse
from app.services.session_service import (
    create_user_session,
    revoke_session,
    check_login_throttling,
    record_failed_login
)
from app.api.deps import get_current_session

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
        samesite="lax",
        secure=False,
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
        },
        firm={
            "id": session.firm_id,
            "name": firm_name,
        }
    )
