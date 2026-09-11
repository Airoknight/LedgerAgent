import json
import hashlib
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def compute_event_hash(
    prev_hash: str,
    event_id: str,
    firm_id: str,
    org_id: str | None,
    client_id: str | None,
    user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    details_json: str,
    timestamp_iso: str
) -> str:
    raw_payload = f"{prev_hash}|{event_id}|{firm_id}|{org_id or ''}|{client_id or ''}|{user_id or ''}|{action}|{entity_type}|{entity_id}|{details_json}|{timestamp_iso}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, index=True, default="default_firm")
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    client_id = Column(String(36), ForeignKey("business_accounts.id"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    actor_name = Column(String(255), default="System Worker", nullable=False)
    
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)

    request_id = Column(String(36), nullable=True)
    source_ip = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    reason = Column(String(255), nullable=True)
    
    # Tamper-evident hash chain
    previous_event_hash = Column(String(64), nullable=True, default=GENESIS_HASH)
    event_hash = Column(String(64), nullable=True, index=True)

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
