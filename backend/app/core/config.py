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
    SECRET_KEY: str = "ledgeragent-super-secret-dev-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    SESSION_COOKIE_NAME: str = "ledgeragent_session"
    SESSION_EXPIRE_HOURS: int = 24
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Single Phase 1 Firm
    DEFAULT_FIRM_ID: str = "default_firm"
    DEFAULT_FIRM_NAME: str = "AiroKnight Studios"

    # First user configuration via environment (never committed hardcoded password)
    ADMIN_EMAIL: Optional[str] = "ca.hehram@ledgeragent.io"
    ADMIN_PASSWORD: Optional[str] = None
    
    # Database
    DATABASE_URL: str = "sqlite:///./ledgeragent.db"
    
    # Storage
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage_local"))
    MAX_UPLOAD_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB

    # Local AI (Ollama)
    OLLAMA_API_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT_SECONDS: float = 30.0

    # OpenRouter Cloud AI (Nvidia Nemotron 3 Ultra 550B)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
    OPENROUTER_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_TIMEOUT_SECONDS: float = 45.0

settings = Settings()

