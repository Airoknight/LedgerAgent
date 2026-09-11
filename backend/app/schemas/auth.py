from pydantic import BaseModel, ConfigDict
from typing import Optional

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    password: str
    totp_code: Optional[str] = None
    recovery_code: Optional[str] = None

class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str = "success"
    user_id: str
    email: str
    full_name: str
    role: str
    firm_id: str
    firm_name: str
    csrf_token: str
    user: Optional[dict] = None
    firm: Optional[dict] = None

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    role: str
    firm_id: str
    firm_name: str
    csrf_token: str
    user: Optional[dict] = None
    firm: Optional[dict] = None

# Backward compatibility
class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    access_token: str
    token_type: str = "bearer"
    user_id: str
    full_name: str
    email: str
    role: str
    organization_name: str
    business_name: str
    business_id: str
    csrf_token: Optional[str] = None

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    role: str
    organization_id: Optional[str] = None
    firm_id: Optional[str] = "default_firm"
    mfa_enabled: bool = False

# New Security & Auth Schemas
class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    recovery_codes: list[str]

class MfaVerifyRequest(BaseModel):
    code: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SessionItem(BaseModel):
    id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: str
    expires_at: str
    is_current: bool = False
