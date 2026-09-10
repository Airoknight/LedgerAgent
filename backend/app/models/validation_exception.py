import json
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class ValidationException(Base, TimestampMixin):
    __tablename__ = "validation_exceptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    record_id = Column(String(36), nullable=True)

    rule_id = Column(String(50), nullable=False, index=True)
    field_name = Column(String(100), nullable=True, index=True)
    severity = Column(String(20), default="medium", nullable=False, index=True) # high, medium, low
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    observed_value = Column(Text, nullable=True)
    expected_value = Column(Text, nullable=True)

    # Status: open, resolved, dismissed
    status = Column(String(50), default="open", nullable=False, index=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    details_json = Column(Text, default="{}", nullable=False)

    firm = relationship("Firm", back_populates="validation_exceptions")
    document = relationship("Document", back_populates="validation_exceptions")

    @property
    def details(self) -> dict:
        try:
            return json.loads(self.details_json)
        except Exception:
            return {}

    @details.setter
    def details(self, val: dict):
        self.details_json = json.dumps(val)

