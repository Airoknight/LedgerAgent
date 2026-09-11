from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Firm(Base, TimestampMixin):
    __tablename__ = "firms"

    id = Column(String(36), primary_key=True, default="default_firm")
    name = Column(String(255), nullable=False, default="AiroKnight Studios")
    slug = Column(String(100), unique=True, index=True, nullable=False, default="airoknight-studios")
    legal_name = Column(String(255), nullable=True, default="AiroKnight Studios LLP")
    pan = Column(String(10), nullable=True, default="AAACA1234A")
    gstin = Column(String(15), nullable=True, default="27AAACA1234A1Z5")
    currency = Column(String(3), default="INR", nullable=False)
    financial_year_start = Column(String(10), default="04-01", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    users = relationship("User", back_populates="firm", cascade="all, delete-orphan")
    businesses = relationship("BusinessAccount", back_populates="firm", cascade="all, delete-orphan")
    sessions = relationship("SessionRecord", back_populates="firm", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="firm")
    extracted_records = relationship("ExtractedRecord", back_populates="firm", cascade="all, delete-orphan")
    validation_exceptions = relationship("ValidationException", back_populates="firm", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="firm", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="firm", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="firm", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="firm")
    settings = relationship("Setting", back_populates="firm", cascade="all, delete-orphan")

