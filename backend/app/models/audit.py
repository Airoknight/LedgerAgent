import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    actor_name = Column(String(255), default="System Worker", nullable=False)
    
    action = Column(String(100), nullable=False, index=True)  # document.upload, validation.run, ca.approve, field.edit
    entity_type = Column(String(50), nullable=False, index=True)  # document, exception, user
    entity_id = Column(String(36), nullable=False, index=True)
    
    details_json = Column(Text, default="{}", nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    firm = relationship("Firm", back_populates="audit_events")
    organization = relationship("Organization", back_populates="audit_events")
    user = relationship("User", back_populates="audit_events")

    @property
    def details(self) -> dict:
        try:
            return json.loads(self.details_json)
        except Exception:
            return {}

    @details.setter
    def details(self, val: dict):
        self.details_json = json.dumps(val)

