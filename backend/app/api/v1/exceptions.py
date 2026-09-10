from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.exception import FinancialException
from app.models.audit import AuditEvent
from app.schemas.exception import ExceptionItem, ExceptionResolution

router = APIRouter(prefix="/exceptions", tags=["Exceptions"])

@router.get("", response_model=List[ExceptionItem])
def list_exceptions(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FinancialException)
    if status:
        query = query.filter(FinancialException.status == status)
    if severity:
        query = query.filter(FinancialException.severity == severity)
    return query.order_by(FinancialException.created_at.desc()).all()

@router.post("/{exception_id}/resolve", response_model=ExceptionItem)
def resolve_exception(
    exception_id: str,
    payload: ExceptionResolution,
    reviewer_name: str = "CA Hehram",
    db: Session = Depends(get_db)
):
    exc = db.query(FinancialException).filter(FinancialException.id == exception_id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")

    exc.status = "resolved" if payload.action == "resolve" else payload.action
    exc.resolution_note = payload.resolution_note
    exc.resolved_by = reviewer_name

    audit = AuditEvent(
        organization_id=exc.business.organization_id if exc.business else "default-org",
        action=f"exception.{payload.action}",
        entity_type="exception",
        entity_id=exc.id,
        actor_name=reviewer_name,
        details={"note": payload.resolution_note}
    )
    db.add(audit)
    db.commit()
    db.refresh(exc)
    return exc

