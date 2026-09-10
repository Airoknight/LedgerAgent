import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models.firm import Firm
from app.models.organization import User
from app.models.session import SessionRecord
from app.core.security import verify_password, get_password_hash
from app.services.seed_service import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    db = SessionLocal()
    init_db(db)
    db.close()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_password_hashing():
    """Verify PBKDF2-SHA256 password hashing and verification."""
    password = "SuperSecretPassword123!"
    hashed = get_password_hash(password)
    assert hashed != password
    assert hashed.startswith("$pbkdf2-sha256$") or "pbkdf2" in hashed
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False

def test_default_firm_and_user_seeding():
    """Verify default firm AiroKnight Studios and admin user are properly seeded."""
    db = SessionLocal()
    firm = db.query(Firm).filter(Firm.id == settings.DEFAULT_FIRM_ID).first()
    assert firm is not None
    assert firm.name == "AiroKnight Studios"
    assert firm.currency == "INR"

    admin_email = os.environ.get("ADMIN_EMAIL", "ca.hehram@ledgeragent.io").strip().lower()
    user = db.query(User).filter(User.email == admin_email).first()
    assert user is not None
    assert user.firm_id == firm.id
    assert user.role == "ca_admin"
    db.close()

def test_cli_user_creation(client):
    """Verify CLI create-user command properly provisions a new user who can authenticate."""
    from app.cli import create_user_command
    cli_email = f"cli_accountant_{uuid.uuid4().hex[:6]}@ledgeragent.io"
    cli_pass = "AiroKnightCli2026!"
    create_user_command(email=cli_email, password=cli_pass, full_name="Test Staff CA", role="ca_staff")

    # Verify user exists in database
    db = SessionLocal()
    user = db.query(User).filter(User.email == cli_email).first()
    assert user is not None
    assert user.full_name == "Test Staff CA"
    assert user.role == "ca_staff"
    assert verify_password(cli_pass, user.hashed_password) is True
    db.close()

    # Verify user can log in via API
    res = client.post("/api/v1/auth/login", json={"email": cli_email, "password": cli_pass})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == cli_email

def test_successful_login_and_cookie_issuance(client):
    """Verify login issues HttpOnly cookie and CSRF token."""
    admin_email = os.environ.get("ADMIN_EMAIL", "ca.hehram@ledgeragent.io").strip().lower()
    admin_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("FIRST_USER_PASSWORD", "AiroKnight2026!Secure")

    res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": admin_pass}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == admin_email
    assert data["firm"]["name"] == "AiroKnight Studios"
    assert "csrf_token" in data
    assert len(data["csrf_token"]) >= 16

    # Verify HttpOnly cookie
    assert settings.SESSION_COOKIE_NAME in res.cookies
    session_id = res.cookies[settings.SESSION_COOKIE_NAME]

    # Verify session persisted in DB
    db = SessionLocal()
    session_obj = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    assert session_obj is not None
    assert session_obj.is_revoked is False
    db.close()

def test_login_throttling_and_lockout(client):
    """Verify 5 failed login attempts trigger account lockout (HTTP 429)."""
    db = SessionLocal()
    # Create an isolated test user to verify lockout without disrupting admin
    test_email = f"staff_{uuid.uuid4().hex[:6]}@ledgeragent.io"
    user = User(
        firm_id=settings.DEFAULT_FIRM_ID,
        email=test_email,
        full_name="Staff Test",
        hashed_password=get_password_hash("CorrectPassword123!"),
        role="staff",
        is_active=True,
        failed_login_attempts=0
    )
    db.add(user)
    db.commit()
    db.close()

    # Make 5 failed attempts
    for i in range(5):
        res = client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": "WrongPassword!"}
        )
        assert res.status_code == 401

    # 6th attempt should be blocked with 429
    res6 = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "WrongPassword!"}
    )
    assert res6.status_code == 429
    assert "locked" in res6.json()["detail"].lower()

def test_protected_routes_unauthenticated_rejection(client):
    """Verify unauthenticated requests to protected endpoints return 401."""
    # Without cookie
    res = client.get("/api/v1/documents")
    assert res.status_code == 401

    # With invalid cookie
    res_fake = client.get(
        "/api/v1/documents",
        cookies={settings.SESSION_COOKIE_NAME: "fake-session-token"}
    )
    assert res_fake.status_code == 401

def test_csrf_protection_on_mutations(client):
    """Verify state-changing operations require matching X-CSRF-Token."""
    admin_email = os.environ.get("ADMIN_EMAIL", "ca.hehram@ledgeragent.io").strip().lower()
    admin_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("FIRST_USER_PASSWORD", "AiroKnight2026!Secure")

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": admin_pass}
    )
    assert login_res.status_code == 200
    csrf_token = login_res.json()["csrf_token"]
    cookie = {settings.SESSION_COOKIE_NAME: login_res.cookies[settings.SESSION_COOKIE_NAME]}

    # Mutation with NO CSRF header -> 403 Forbidden
    no_csrf_res = client.post(
        "/api/v1/chat/query",
        cookies=cookie,
        json={"query": "hello"}
    )
    assert no_csrf_res.status_code == 403
    assert "csrf" in no_csrf_res.json()["detail"].lower()

    # Mutation with INVALID CSRF header -> 403 Forbidden
    bad_csrf_res = client.post(
        "/api/v1/chat/query",
        cookies=cookie,
        headers={"X-CSRF-Token": "invalid-csrf-token"},
        json={"query": "hello"}
    )
    assert bad_csrf_res.status_code == 403

    # Mutation with VALID CSRF header -> 200 OK
    good_res = client.post(
        "/api/v1/chat/query",
        cookies=cookie,
        headers={"X-CSRF-Token": csrf_token},
        json={"query": "hello"}
    )
    assert good_res.status_code == 200

def test_session_logout_and_revocation(client):
    """Verify logout revokes the server session and invalidates subsequent requests."""
    admin_email = os.environ.get("ADMIN_EMAIL", "ca.hehram@ledgeragent.io").strip().lower()
    admin_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("FIRST_USER_PASSWORD", "AiroKnight2026!Secure")

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": admin_pass}
    )
    assert login_res.status_code == 200
    csrf_token = login_res.json()["csrf_token"]
    cookie = {settings.SESSION_COOKIE_NAME: login_res.cookies[settings.SESSION_COOKIE_NAME]}

    # Check authenticated /me succeeds
    me_res = client.get("/api/v1/auth/me", cookies=cookie)
    assert me_res.status_code == 200

    # Logout
    logout_res = client.post(
        "/api/v1/auth/logout",
        cookies=cookie,
        headers={"X-CSRF-Token": csrf_token}
    )
    assert logout_res.status_code == 200

    # Subsequent call with old session cookie must be rejected (401)
    me_after = client.get("/api/v1/auth/me", cookies=cookie)
    assert me_after.status_code == 401

def test_session_expiry_handling(client):
    """Verify expired sessions in DB are rejected."""
    db = SessionLocal()
    user = db.query(User).filter(User.firm_id == settings.DEFAULT_FIRM_ID).first()
    expired_session = SessionRecord(
        id=uuid.uuid4().hex,
        user_id=user.id,
        firm_id=user.firm_id,
        csrf_token=uuid.uuid4().hex,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1), # Expired 1 hour ago
        is_revoked=False
    )
    db.add(expired_session)
    db.commit()
    expired_id = expired_session.id
    db.close()

    res = client.get(
        "/api/v1/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: expired_id}
    )
    assert res.status_code == 401

def test_security_response_headers(client):
    """Verify security headers (nosniff, SAMEORIGIN, strict-origin-when-cross-origin)."""
    res = client.get("/api/v1/health/live")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
