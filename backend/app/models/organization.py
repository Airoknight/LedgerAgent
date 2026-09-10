from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    users = relationship("User", back_populates="organization")
    businesses = relationship("BusinessAccount", back_populates="organization")
    documents = relationship("Document", back_populates="organization")
    audit_events = relationship("AuditEvent", back_populates="organization")

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="ca_admin", nullable=False)  # ca_admin, accountant, bookkeeper, reviewer
    is_active = Column(Boolean, default=True, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)

    firm = relationship("Firm", back_populates="users")
    organization = relationship("Organization", back_populates="users")
    sessions = relationship("SessionRecord", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user")
    audit_events = relationship("AuditEvent", back_populates="user")

class BusinessAccount(Base, TimestampMixin):
    __tablename__ = "business_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    legal_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    gstin = Column(String(15), nullable=True, index=True)
    pan = Column(String(10), nullable=True, index=True)
    currency = Column(String(3), default="INR", nullable=False)
    financial_year_start = Column(String(10), default="04-01", nullable=False)

    organization = relationship("Organization", back_populates="businesses")
    documents = relationship("Document", back_populates="business")
    exceptions = relationship("FinancialException", back_populates="business")
