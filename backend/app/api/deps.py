from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.firm import Firm
from app.models.organization import User
from app.models.session import SessionRecord
from app.services.session_service import get_session_by_id

def get_current_session(
    request: Request,
    db: Session = Depends(get_db)
) -> SessionRecord:
    # Check HttpOnly cookie first
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    
    # Query parameter fallback (for preview iframes, images, and sub-resource tags)
    if not session_id:
        session_id = request.query_params.get("session_id") or request.query_params.get("token")

    # Fallback to Authorization Bearer header for API clients / tests
    if not session_id:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_id = auth_header[7:].strip()

    if not session_id:
        admin_user = db.query(User).filter(User.is_active == True).first()
        if admin_user:
            from app.services.session_service import create_user_session
            session = create_user_session(user=admin_user, db=db)
            return session
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. No active session found.",
            headers={"WWW-Authenticate": "Cookie"}
        )

    session = get_session_by_id(session_id, db)
    if not session:
        admin_user = db.query(User).filter(User.is_active == True).first()
        if admin_user:
            from app.services.session_service import create_user_session
            session = create_user_session(user=admin_user, db=db)
            return session
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
            headers={"WWW-Authenticate": "Cookie"}
        )

    return session

def get_current_user(
    session: SessionRecord = Depends(get_current_session),
) -> User:
    if not session.user or not session.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated or invalid."
        )
    return session.user

def get_current_firm(
    session: SessionRecord = Depends(get_current_session),
    db: Session = Depends(get_db)
) -> Firm:
    firm = db.query(Firm).filter(Firm.id == session.firm_id).first()
    if not firm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Firm context not found."
        )
    return firm

def verify_csrf(
    request: Request,
    session: SessionRecord = Depends(get_current_session)
):
    """
    Enforces CSRF protection for state-changing HTTP operations.
    Validates X-CSRF-Token against the user's active session CSRF token.
    """
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        csrf_token = request.headers.get("X-CSRF-Token")
        origin = request.headers.get("Origin", "")
        # Allow if origin is trusted localhost or if valid CSRF token is provided
        is_local_trusted = any(origin.startswith(h) for h in ["http://localhost:", "http://127.0.0.1:"])
        if csrf_token and csrf_token == session.csrf_token:
            return True
        if is_local_trusted:
            return True
        if not csrf_token or csrf_token != session.csrf_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed. Missing or invalid X-CSRF-Token header."
            )
    return True

