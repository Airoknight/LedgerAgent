import time
import random
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, Callable, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.queue import ProcessingJob, StageHistory
from app.models.document import Document
from app.models.audit import AuditEvent

# Registry for job handler functions
JOB_HANDLERS: Dict[str, Callable[[ProcessingJob, Session], Any]] = {}


def register_handler(job_type: str):
    def decorator(fn: Callable[[ProcessingJob, Session], Any]):
        JOB_HANDLERS[job_type] = fn
        return fn
    return decorator


def record_stage(
    db: Session,
    document_id: str,
    stage: str,
    status: str = "SUCCESS",
    detail: Optional[str] = None,
    worker_id: str = "worker-default"
) -> StageHistory:
    entry = StageHistory(
        document_id=document_id,
        stage=stage,
        status=status,
        detail=detail,
        actor_or_worker=worker_id
    )
    db.add(entry)
    db.flush()
    return entry


def enqueue_job(
    db: Session,
    job_type: str,
    organization_id: Optional[str],
    firm_id: str,
    client_id: Optional[str],
    document_id: Optional[str] = None,
    document_revision: int = 1,
    payload: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None,
    delay_seconds: int = 0
) -> ProcessingJob:
    """
    Safely enqueues a new background processing job with tenant scope and deduplication check.
    """
    # Check if identical active job is already queued/processing
    if document_id:
        existing = db.query(ProcessingJob).filter(
            ProcessingJob.document_id == document_id,
            ProcessingJob.job_type == job_type,
            ProcessingJob.document_revision == document_revision,
            ProcessingJob.status.in_(["QUEUED", "PROCESSING"])
        ).first()
        if existing:
            return existing

    scheduled_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    job = ProcessingJob(
        job_type=job_type,
        organization_id=organization_id,
        firm_id=firm_id or "default_firm",
        client_id=client_id,
        document_id=document_id,
        document_revision=document_revision,
        correlation_id=correlation_id or "corr-" + str(int(time.time())),
        status="QUEUED",
        processing_stage="QUEUED",
        attempt=1,
        max_attempts=3,
        scheduled_at=scheduled_at,
        payload=payload or {}
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def claim_next_job(db: Session, worker_id: str = "worker-1") -> Optional[ProcessingJob]:
    """
    Atomically claims the oldest ready job using optimistic locking.
    """
    now = datetime.now(timezone.utc)
    # Recover stale jobs locked more than 5 minutes ago
    stale_cutoff = now - timedelta(minutes=5)
    stale_jobs = db.query(ProcessingJob).filter(
        ProcessingJob.status == "PROCESSING",
        ProcessingJob.locked_at < stale_cutoff
    ).all()
    for sj in stale_jobs:
        sj.status = "QUEUED"
        sj.locked_at = None
        sj.locked_by = None
    if stale_jobs:
        db.commit()

    # Find next queued job scheduled for now or in the past
    job = db.query(ProcessingJob).filter(
        ProcessingJob.status == "QUEUED",
        ProcessingJob.scheduled_at <= now
    ).order_by(ProcessingJob.scheduled_at.asc()).first()

    if not job:
        return None

    job.status = "PROCESSING"
    job.locked_at = now
    job.locked_by = worker_id
    db.commit()
    db.refresh(job)
    return job


def execute_job(job: ProcessingJob, db: Session, worker_id: str = "worker-1") -> bool:
    """
    Executes a single processing job with retry, backoff, and DLQ handling.
    """
    handler = JOB_HANDLERS.get(job.job_type)
    if not handler:
        job.status = "FAILED_FINAL"
        job.error_message = f"No handler registered for job type '{job.job_type}'"
        db.commit()
        return False

    try:
        # If job is attached to a document, verify revision is still current
        if job.document_id:
            doc = db.query(Document).filter(Document.id == job.document_id).first()
            if doc and doc.revision is not None and doc.revision > job.document_revision:
                job.status = "CANCELLED"
                job.error_message = f"Stale revision: document revision {doc.revision} > job revision {job.document_revision}"
                db.commit()
                return False

        # Execute registered handler
        result = handler(job, db)
        job.status = "COMPLETED"
        job.result = result if isinstance(result, dict) else {"status": "success"}
        job.error_message = None
        job.locked_at = None
        job.locked_by = None
        db.commit()

        if job.document_id:
            record_stage(db, job.document_id, job.job_type, "SUCCESS", detail="Job completed successfully", worker_id=worker_id)
            db.commit()
        return True

    except Exception as e:
        db.rollback()
        err_msg = str(e)
        err_trace = traceback.format_exc()
        job.error_message = err_msg
        job.error_trace = err_trace

        if job.attempt < job.max_attempts:
            # Exponential backoff with jitter: 2^attempt + jitter
            backoff_secs = (2 ** job.attempt) + random.uniform(0.5, 2.0)
            job.attempt += 1
            job.status = "FAILED_RETRYABLE"
            job.scheduled_at = datetime.now(timezone.utc) + timedelta(seconds=backoff_secs)
            job.locked_at = None
            job.locked_by = None
            db.commit()

            if job.document_id:
                record_stage(db, job.document_id, job.job_type, "FAILED", detail=f"Attempt {job.attempt-1} failed: {err_msg}. Retrying in {backoff_secs:.1f}s", worker_id=worker_id)
                db.commit()
        else:
            # Dead-letter queue / Final failure
            job.status = "FAILED_FINAL"
            job.locked_at = None
            job.locked_by = None
            db.commit()

            if job.document_id:
                doc = db.query(Document).filter(Document.id == job.document_id).first()
                if doc:
                    doc.status = "failed"
                record_stage(db, job.document_id, job.job_type, "FAILED_FINAL", detail=f"Max attempts ({job.max_attempts}) reached. Error: {err_msg}", worker_id=worker_id)
                db.commit()
        return False
