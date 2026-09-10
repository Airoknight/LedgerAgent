from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.security import generate_session_id, generate_csrf_token
from app.models.firm import Firm
from app.models.organization import User
from app.models.session import SessionRecord
from app.models.audit import AuditEvent

def create_user_session(
    user: User,
    db: Session,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SessionRecord:
    session_id = generate_session_id()
    csrf_token = generate_csrf_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)

    session = SessionRecord(
        id=session_id,
        user_id=user.id,
        firm_id=user.firm_id or settings.DEFAULT_FIRM_ID,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        csrf_token=csrf_token,
        ip_address=ip_address,
        user_agent=user_agent,
        is_revoked=False
    )
    db.add(session)

    # Reset failed login count on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)

    audit = AuditEvent(
        firm_id=session.firm_id,
        user_id=user.id,
        actor_name=user.full_name,
        action="auth.login_success",
        entity_type="session",
        entity_id=session.id,
        details_json=f'{{"ip_address": "{ip_address}", "user_agent": "{user_agent}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(session)
    return session

def get_session_by_id(session_id: str, db: Session) -> Optional[SessionRecord]:
    if not session_id:
        return None
    session = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not session or not session.is_valid:
        return None
    return session

def revoke_session(session_id: str, db: Session) -> bool:
    session = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if session:
        session.is_revoked = True
        audit = AuditEvent(
            firm_id=session.firm_id,
            user_id=session.user_id,
            actor_name=session.user.full_name if session.user else "User",
            action="auth.logout",
            entity_type="session",
            entity_id=session.id,
            details_json='{"status": "revoked"}'
        )
        db.add(audit)
        db.commit()
        return True
    return False

def check_login_throttling(user: User, db: Session) -> Tuple[bool, Optional[str]]:
    """Checks if the user account is locked due to too many failed attempts."""
    now = datetime.now(timezone.utc)
    if user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            remaining_mins = int((locked_until - now).total_seconds() / 60) + 1
            return True, f"Account temporarily locked due to repeated failed attempts. Please try again in {remaining_mins} minutes."
        else:
            # Lock has expired, reset
            user.failed_login_attempts = 0
            user.locked_until = None
            db.commit()
    return False, None

def record_failed_login(user: Optional[User], email: str, db: Session, ip_address: Optional[str] = None):
    """Increments failed login counter and locks account if threshold exceeded."""
    if user:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            audit = AuditEvent(
                firm_id=user.firm_id or settings.DEFAULT_FIRM_ID,
                user_id=user.id,
                actor_name=user.full_name,
                action="auth.login_locked",
                entity_type="user",
                entity_id=user.id,
                details_json=f'{{"failed_attempts": {user.failed_login_attempts}, "lockout_minutes": {settings.LOGIN_LOCKOUT_MINUTES}}}'
            )
            db.add(audit)
        else:
            audit = AuditEvent(
                firm_id=user.firm_id or settings.DEFAULT_FIRM_ID,
                user_id=user.id,
                actor_name=user.full_name,
                action="auth.login_failed",
                entity_type="user",
                entity_id=user.id,
                details_json=f'{{"failed_attempts": {user.failed_login_attempts}}}'
            )
            db.add(audit)
        db.commit()
    else:
        # Non-existent email failed attempt
        audit = AuditEvent(
            firm_id=settings.DEFAULT_FIRM_ID,
            actor_name="Unknown",
            action="auth.login_failed_unknown_user",
            entity_type="user",
            entity_id=email,
            details_json=f'{{"email": "{email}", "ip_address": "{ip_address}"}}'
        )
        db.add(audit)
        db.commit()

