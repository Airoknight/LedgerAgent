from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import require_permission, TenantContext, Permission
from app.models.audit import AuditEvent
from app.services.audit_service import verify_audit_chain

router = APIRouter(prefix="/audit", tags=["Audit & Governance"])

@router.get("/events")
def list_audit_events(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    context: TenantContext = Depends(require_permission(Permission.AUDIT_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns tenant-scoped audit events with cryptographically chained hashes.
    """
    query = db.query(AuditEvent).filter(AuditEvent.firm_id == context.organization_id)
    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if action:
        query = query.filter(AuditEvent.action == action)

    total = query.count()
    events = query.order_by(AuditEvent.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": [
            {
                "id": e.id,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "actor_name": e.actor_name,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "details": e.details,
                "request_id": e.request_id,
                "source_ip": e.source_ip,
                "previous_event_hash": e.previous_event_hash,
                "event_hash": e.event_hash
            }
            for e in events
        ]
    }

@router.get("/verify-chain")
def verify_audit_hash_chain(
    limit: int = Query(default=500, le=2000),
    context: TenantContext = Depends(require_permission(Permission.AUDIT_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Cryptographically verifies the SHA-256 hash chain of the audit log.
    Detects any inserted, modified, or deleted historical records.
    """
    result = verify_audit_chain(db, limit=limit)
    return result
