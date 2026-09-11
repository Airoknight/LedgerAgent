import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent, GENESIS_HASH, compute_event_hash
from app.models.base import generate_uuid

def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_name: str = "System Worker",
    user_id: Optional[str] = None,
    firm_id: str = "default_firm",
    organization_id: Optional[str] = None,
    client_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    source_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    reason: Optional[str] = None
) -> AuditEvent:
    """
    Creates an append-only, tamper-evident audit event securely linked into the cryptographic hash chain.
    """
    # Fetch previous event in the chain to get previous_event_hash
    last_event = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc(), AuditEvent.id.desc()).first()
    prev_hash = last_event.event_hash if (last_event and last_event.event_hash) else GENESIS_HASH

    event_id = generate_uuid()
    now_dt = datetime.now(timezone.utc)
    details_str = json.dumps(details or {})
    time_str = now_dt.strftime("%Y-%m-%dT%H:%M:%S")

    event_hash = compute_event_hash(
        prev_hash=prev_hash,
        event_id=event_id,
        firm_id=firm_id,
        org_id=organization_id,
        client_id=client_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details_json=details_str,
        timestamp_iso=time_str
    )

    event = AuditEvent(
        id=event_id,
        firm_id=firm_id,
        organization_id=organization_id,
        client_id=client_id,
        user_id=user_id,
        actor_name=actor_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        request_id=request_id,
        source_ip=source_ip,
        user_agent=user_agent,
        reason=reason,
        previous_event_hash=prev_hash,
        event_hash=event_hash,
        details_json=details_str,
        timestamp=now_dt
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def verify_audit_chain(db: Session, limit: int = 500) -> Dict[str, Any]:
    """
    Cryptographically verifies the integrity of the audit chain:
    - Confirms previous_event_hash linkage
    - Recomputes each event's hash to verify no records have been altered or deleted
    """
    events: List[AuditEvent] = db.query(AuditEvent).filter(
        AuditEvent.event_hash != None
    ).order_by(AuditEvent.timestamp.asc(), AuditEvent.id.asc()).limit(limit).all()

    if not events:
        return {"verified": True, "total_events": 0, "status": "empty_chain", "broken_at_event_id": None}

    expected_prev_hash = events[0].previous_event_hash or GENESIS_HASH
    for idx, event in enumerate(events):
        # 1. Check link to previous hash
        if idx > 0 and event.previous_event_hash != expected_prev_hash:
            return {
                "verified": False,
                "total_events": len(events),
                "verified_count": idx,
                "broken_at_event_id": event.id,
                "error": f"Chain linkage broken at index {idx}: expected prev {expected_prev_hash[:12]}..., got {event.previous_event_hash[:12]}..."
            }

        # 2. Recompute current event hash
        time_str = event.timestamp.strftime("%Y-%m-%dT%H:%M:%S") if event.timestamp else ""
        recomputed = compute_event_hash(
            prev_hash=event.previous_event_hash or GENESIS_HASH,
            event_id=event.id,
            firm_id=event.firm_id,
            org_id=event.organization_id,
            client_id=event.client_id,
            user_id=event.user_id,
            action=event.action,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            details_json=event.details_json,
            timestamp_iso=time_str
        )
        if recomputed != event.event_hash:
            return {
                "verified": False,
                "total_events": len(events),
                "verified_count": idx,
                "broken_at_event_id": event.id,
                "error": f"Event hash mismatch at event {event.id}: data has been altered after creation"
            }
        expected_prev_hash = event.event_hash

    return {
        "verified": True,
        "total_events": len(events),
        "verified_count": len(events),
        "latest_hash": expected_prev_hash,
        "status": "valid_tamper_evident_chain"
    }
