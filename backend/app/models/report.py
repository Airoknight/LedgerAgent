import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    report_type = Column(String(50), nullable=False, index=True) # processing_summary, exception_report, reconciliation_summary
    title = Column(String(255), nullable=False)
    period = Column(String(50), nullable=False, default="September 2026")
    data_json = Column(Text, default="{}", nullable=False)
    created_by = Column(String(255), default="CA Hehram", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    firm = relationship("Firm", back_populates="reports")

    @property
    def data(self) -> dict:
        try:
            return json.loads(self.data_json)
        except Exception:
            return {}

    @data.setter
    def data(self, val: dict):
        self.data_json = json.dumps(val)

