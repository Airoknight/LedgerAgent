import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

class ProcessingJob(Base, TimestampMixin):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_type = Column(String(50), nullable=False, index=True)
    # Organization / Firm / Client tenant scope
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    firm_id = Column(String(36), ForeignKey("firms.id"), nullable=False, default="default_firm", index=True)
    client_id = Column(String(36), ForeignKey("business_accounts.id"), nullable=True, index=True)

    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)
    document_revision = Column(Integer, default=1, nullable=False)
    correlation_id = Column(String(36), nullable=False, default=generate_uuid, index=True)

    # Status: QUEUED, PROCESSING, COMPLETED, FAILED_RETRYABLE, FAILED_FINAL, CANCELLED
    status = Column(String(30), default="QUEUED", nullable=False, index=True)
    processing_stage = Column(String(50), default="QUEUED", nullable=False)

    attempt = Column(Integer, default=1, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    scheduled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(String(100), nullable=True)

    payload_json = Column(Text, default="{}", nullable=False)
    result_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    error_trace = Column(Text, nullable=True)

    @property
    def payload(self) -> dict:
        try:
            return json.loads(self.payload_json or "{}")
        except Exception:
            return {}

    @payload.setter
    def payload(self, val: dict):
        self.payload_json = json.dumps(val or {})

    @property
    def result(self) -> dict | None:
        if not self.result_json:
            return None
        try:
            return json.loads(self.result_json)
        except Exception:
            return None

    @result.setter
    def result(self, val: dict | None):
        self.result_json = json.dumps(val) if val is not None else None


class StageHistory(Base, TimestampMixin):
    __tablename__ = "stage_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    stage = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="SUCCESS", nullable=False)  # SUCCESS, FAILED, IN_PROGRESS
    detail = Column(Text, nullable=True)
    actor_or_worker = Column(String(100), default="system", nullable=False)
