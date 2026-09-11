import hmac
import hashlib
import struct
import time
import base64
import secrets
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from app.core.config import settings

# Robust, cross-platform enterprise password hashing with PBKDF2-SHA256
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Fernet cipher for authenticated file encryption at rest
def _get_fernet_cipher() -> Fernet:
    key = settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY
    # Ensure key is valid 32-byte url-safe base64
    try:
        return Fernet(key)
    except Exception:
        # Pad or derive deterministic key if malformed in dev
        derived = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
        return Fernet(derived)

def encrypt_bytes(data: bytes) -> bytes:
    """Encrypts bytes using authenticated Fernet (AES-128-CBC + HMAC-SHA256)."""
    cipher = _get_fernet_cipher()
    return cipher.encrypt(data)

def decrypt_bytes(token: bytes) -> bytes:
    """Decrypts and authenticates Fernet encrypted bytes."""
    cipher = _get_fernet_cipher()
    return cipher.decrypt(token)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def validate_password_complexity(password: str) -> Tuple[bool, Optional[str]]:
    """Validates password against enterprise complexity policy."""
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long."
    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if settings.PASSWORD_REQUIRE_SYMBOL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character (!@#$%^&*...)."
    return True, None

def generate_session_id() -> str:
    return secrets.token_hex(32)

def generate_csrf_token() -> str:
    return secrets.token_hex(32)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.SESSION_EXPIRE_HOURS * 60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

# ==============================================================================
# Password Reset Single-Use Tokens
# ==============================================================================

def generate_password_reset_token(user_id: str, email: str) -> str:
    """Generates a 15-minute single-use cryptographic password reset token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": user_id,
        "email": email,
        "purpose": "password_reset",
        "jti": secrets.token_hex(16),
        "exp": expire
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_password_reset_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload
    except JWTError:
        return None

# ==============================================================================
# TOTP Multi-Factor Authentication (RFC 6238 Standard)
# ==============================================================================

def generate_totp_secret() -> str:
    """Generates a base32 encoded 160-bit secret for TOTP authenticators."""
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8")

def get_totp_token(secret: str, time_step: int = 30) -> str:
    """Computes current 6-digit TOTP token using standard HMAC-SHA1."""
    try:
        key = base64.b32decode(secret, casefold=True)
    except Exception:
        return ""
    counter = int(time.time() // time_step)
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = (struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code:06d}"

def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    """Verifies a 6-digit TOTP code allowing ±1 time step clock drift."""
    if not secret or not code or len(code.strip()) != 6:
        return False
    try:
        key = base64.b32decode(secret, casefold=True)
    except Exception:
        return False

    current_counter = int(time.time() // 30)
    clean_code = code.strip()

    for offset_step in range(-window, window + 1):
        msg = struct.pack(">Q", current_counter + offset_step)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        expected = (struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
        if f"{expected:06d}" == clean_code:
            return True
    return False

def generate_recovery_codes(count: int = 10) -> List[str]:
    """Generates human-readable single-use backup recovery codes."""
    codes = []
    for _ in range(count):
        part1 = secrets.token_hex(3).upper()
        part2 = secrets.token_hex(3).upper()
        codes.append(f"{part1}-{part2}")
    return codes

def hash_recovery_code(code: str) -> str:
    clean = code.strip().upper().replace("-", "")
    return hashlib.sha256(clean.encode()).hexdigest()

def verify_recovery_code(code: str, hashed_code: str) -> bool:
    clean = code.strip().upper().replace("-", "")
    return hmac.compare_digest(hashlib.sha256(clean.encode()).hexdigest(), hashed_code)

