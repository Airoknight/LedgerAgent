import json
from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class ExtractedRecord(Base, TimestampMixin):
    __tablename__ = "extracted_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    
    # invoice_header, receipt, bank_row, gstr2b_row
    record_type = Column(String(50), nullable=False, index=True)
    record_json = Column(Text, default="{}", nullable=False)
    normalized_json = Column(Text, default="{}", nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=False)
    status = Column(String(50), default="extracted", nullable=False)
    revision = Column(Integer, default=1, nullable=False)

    firm = relationship("Firm", back_populates="extracted_records")
    document = relationship("Document", back_populates="extracted_records")

    @property
    def data(self) -> dict:
        try:
            return json.loads(self.record_json)
        except Exception:
            return {}

    @data.setter
    def data(self, val: dict):
        self.record_json = json.dumps(val)

    @property
    def normalized(self) -> dict:
        try:
            return json.loads(self.normalized_json)
        except Exception:
            return {}

    @normalized.setter
    def normalized(self, val: dict):
        self.normalized_json = json.dumps(val)

