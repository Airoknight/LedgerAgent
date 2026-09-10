from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    record_id = Column(String(36), nullable=True)
    approved_by = Column(String(255), nullable=False)
    approval_type = Column(String(50), default="document", nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    firm = relationship("Firm", back_populates="approvals")
    document = relationship("Document", back_populates="approvals")

