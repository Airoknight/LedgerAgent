from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)  # Cryptographic session token
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    csrf_token = Column(String(64), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False, index=True)

    user = relationship("User", back_populates="sessions")
    firm = relationship("Firm", back_populates="sessions")

    @property
    def is_valid(self) -> bool:
        if self.is_revoked:
            return False
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > datetime.now(timezone.utc)

