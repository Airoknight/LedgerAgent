import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    APP_NAME: str = "LedgerAgent"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Server binding
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # API & CORS
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    ALLOWED_HOSTS: List[str] = ["127.0.0.1", "localhost", "127.0.0.1:8000", "localhost:8000"]
    
    # Security & Sessions
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ledgeragent-super-secret-dev-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    SESSION_COOKIE_NAME: str = "ledgeragent_session"
    SESSION_EXPIRE_HOURS: int = 24
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    COOKIE_SECURE: bool = False  # Set to True in production with HTTPS
    COOKIE_SAMESITE: str = "lax"

    # Encryption at rest (Fernet / AES-256-GCM key)
    # 32-byte base64 encoded key
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1Y=")
    ENCRYPT_FILES_AT_REST: bool = os.getenv("ENCRYPT_FILES_AT_REST", "false").lower() == "true"

    # Password Policy
    PASSWORD_MIN_LENGTH: int = 10
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SYMBOL: bool = True

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_UPLOAD: str = "20/minute"
    RATE_LIMIT_EXPORT: str = "10/minute"

    # Asynchronous Job Queue
    QUEUE_BACKEND: str = os.getenv("QUEUE_BACKEND", "database")  # "database" | "redis"
    QUEUE_MAX_ATTEMPTS: int = 3
    QUEUE_RETRY_BACKOFF_SECONDS: float = 2.0
    QUEUE_POLL_INTERVAL_SECONDS: float = 1.0

    # Sensitive Data Protection & AI Privacy
    ENABLE_FIELD_MASKING: bool = True
    LOCAL_AI_ONLY: bool = os.getenv("LOCAL_AI_ONLY", "false").lower() == "true"
    AI_ALLOW_EXTERNAL_CALLS: bool = os.getenv("AI_ALLOW_EXTERNAL_CALLS", "true").lower() == "true"

    # Single Phase 1 Firm / Default Tenant
    DEFAULT_FIRM_ID: str = "default_firm"
    DEFAULT_FIRM_NAME: str = "AiroKnight Studios"
    DEFAULT_CLIENT_ID: str = "default_business"
    DEFAULT_CLIENT_NAME: str = "AiroKnight Accounting Studio"

    # First user configuration via environment (never committed hardcoded password)
    ADMIN_EMAIL: Optional[str] = "ca.hehram@ledgeragent.io"
    ADMIN_PASSWORD: Optional[str] = None
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./ledgeragent.db")
    
    # Storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage_local")))
    MAX_UPLOAD_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB

    # Local AI (Ollama)
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    OLLAMA_TIMEOUT_SECONDS: float = 30.0

    # Dedicated OCR & Document Intake AI (OpenRouter)
    OCR_OPENROUTER_API_KEY: str = os.getenv("OCR_OPENROUTER_API_KEY", "")
    OCR_OPENROUTER_MODEL: str = os.getenv("OCR_OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    OCR_OPENROUTER_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    OCR_OPENROUTER_TIMEOUT_SECONDS: float = 20.0

    # Dedicated Chatbot Copilot AI (OpenRouter)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
    OPENROUTER_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_TIMEOUT_SECONDS: float = 45.0

    def validate_production_config(self) -> None:
        """Enforces fail-closed security invariants when running in production."""
        if self.ENVIRONMENT.lower() == "production":
            errors = []
            if self.DEBUG:
                errors.append("DEBUG mode must be False in production.")
            if "dev-key" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                errors.append("SECRET_KEY must be set to a secure random string of at least 32 characters in production.")
            if self.ENCRYPTION_KEY == "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1Y=":
                errors.append("ENCRYPTION_KEY must be set to a secure, unique 32-byte key in production.")
            if not self.COOKIE_SECURE:
                errors.append("COOKIE_SECURE must be True in production (HTTPS required).")
            if errors:
                raise RuntimeError("PRODUCTION SECURITY VALIDATION FAILED:\n" + "\n".join(f"- {e}" for e in errors))

settings = Settings()
if settings.ENVIRONMENT.lower() == "production":
    settings.validate_production_config()

