import json
from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class FinancialException(Base, TimestampMixin):
    __tablename__ = "financial_exceptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("business_accounts.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)
    
    # Exception type: arithmetic_mismatch, tax_rate_mismatch, missing_field, duplicate_candidate, changed_bank_details, missing_supporting_doc
    exception_type = Column(String(50), nullable=False, index=True)
    # Severity: high, medium, low
    severity = Column(String(20), default="medium", nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_action = Column(String(255), nullable=True)
    
    # Status: open, resolved, dismissed, client_followup_drafted
    status = Column(String(50), default="open", nullable=False, index=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    
    details_json = Column(Text, default="{}", nullable=False)

    business = relationship("BusinessAccount", back_populates="exceptions")
    document = relationship("Document", back_populates="exceptions")

    @property
    def details(self) -> dict:
        try:
            return json.loads(self.details_json)
        except Exception:
            return {}

    @details.setter
    def details(self, val: dict):
        self.details_json = json.dumps(val)

