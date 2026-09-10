import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.models.document import Document
from app.models.organization import BusinessAccount, Organization
from app.models.audit import AuditEvent
from app.models.validation_exception import ValidationException
from app.models.exception import FinancialException
from app.schemas.document import DocumentItem, BatchUploadResponse, DocumentFieldUpdate
from app.services.intake_service import handle_batch_upload
from app.services.rule_engine import validate_extracted_data
from app.services.normalizer import normalize_and_persist

router = APIRouter(tags=["Documents & Intake"])
file_router = APIRouter(tags=["Document File Preview"])

@router.post("/intake/upload", response_model=BatchUploadResponse)
def upload_files(
    files: List[UploadFile] = File(...),
    intake_message: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    biz = db.query(BusinessAccount).first()
    if not biz:
        raise HTTPException(status_code=400, detail="No active business account found.")

    res = handle_batch_upload(
        files=files,
        organization_id=biz.organization_id,
        business_id=biz.id,
        intake_message=intake_message,
        db=db
    )
    return res

@router.get("/documents", response_model=List[DocumentItem])
def list_documents(
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Document)
    if status:
        query = query.filter(Document.status == status)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    return query.order_by(Document.created_at.desc()).all()

@router.get("/documents/{document_id}", response_model=DocumentItem)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@file_router.get("/documents/{document_id}/file")
@router.get("/documents/{document_id}/file")
def get_document_file(document_id: str, db: Session = Depends(get_db)):
    """Serves the actual uploaded file bytes for inline preview in the browser iframe/img"""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        file_path = storage.get_path(doc.storage_key, "originals")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File bytes not found in storage")

        return FileResponse(
            path=file_path,
            media_type=doc.mime_type,
            filename=doc.original_filename,
            content_disposition_type="inline"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing file: {str(e)}")

@router.post("/documents/{document_id}/approve", response_model=DocumentItem)
def approve_document(
    document_id: str,
    reviewer_name: str = "CA Hehram",
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Workflow Control: Block CA approval while unresolved high-severity exceptions exist
    open_high_val = db.query(ValidationException).filter(
        ValidationException.document_id == document_id,
        ValidationException.severity == "high",
        ValidationException.status == "open"
    ).count()

    open_high_fin = db.query(FinancialException).filter(
        FinancialException.document_id == document_id,
        FinancialException.severity == "high",
        FinancialException.status == "open"
    ).count()

    total_high = max(open_high_val, open_high_fin)
    if total_high > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Approval blocked: Document has {total_high} unresolved high-severity exception(s). Discrepancies must be resolved or corrected before CA approval."
        )

    doc.review_status = "approved_by_ca"
    doc.reviewed_by = reviewer_name
    doc.reviewed_at = datetime.now(timezone.utc).isoformat()

    audit = AuditEvent(
        organization_id=doc.organization_id,
        action="ca.document_approved",
        entity_type="document",
        entity_id=doc.id,
        actor_name=reviewer_name,
        details={"previous_review_status": "pending_review", "new_review_status": "approved_by_ca"}
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return doc

@router.post("/documents/{document_id}/fields", response_model=DocumentItem)
def update_document_field(
    document_id: str,
    payload: DocumentFieldUpdate,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Workflow Control 1: Require a reason for field correction
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required for field correction.")

    # Workflow Control 2: Reject edits made against an outdated revision
    if payload.expected_revision is not None and doc.revision is not None and payload.expected_revision != doc.revision:
        raise HTTPException(
            status_code=409,
            detail=f"Revision conflict: document is at revision {doc.revision}, but edit was submitted for revision {payload.expected_revision}."
        )

    was_approved = (doc.review_status == "approved_by_ca")
    data = (doc.extracted_data or {}).copy()
    old_value = data.get(payload.field_name)
    data[payload.field_name] = payload.updated_value

    # Synchronize total and grand_total if one is updated
    if payload.field_name in ["total", "grand_total"]:
        data["total"] = payload.updated_value
        data["grand_total"] = payload.updated_value

    doc.extracted_data = data

    # Workflow Control 3: Invalidate CA approval after any correction
    doc.review_status = "pending_review"
    doc.reviewed_by = None
    doc.reviewed_at = None

    # Workflow Control 4: Increment revision
    doc.revision = (doc.revision or 1) + 1

    # Workflow Control 5: Re-run deterministic layered rule engine on updated data
    new_exceptions = validate_extracted_data(
        doc_id=doc.id,
        firm_id=doc.firm_id or "default_firm",
        doc_type=doc.document_type,
        data=data,
        db=db
    )

    # Clear prior open exceptions for this document
    db.query(ValidationException).filter(
        ValidationException.document_id == doc.id,
        ValidationException.status == "open"
    ).delete()

    db.query(FinancialException).filter(
        FinancialException.document_id == doc.id,
        FinancialException.status == "open"
    ).delete()

    # Re-normalize into canonical registers
    normalize_and_persist(
        db=db,
        document_id=doc.id,
        firm_id=doc.firm_id or "default_firm",
        category=doc.document_type,
        extracted_data=data,
        raw_ocr_text=doc.ocr_text or ""
    )

    # Persist new exceptions if any
    for exc in new_exceptions:
        exc.document_id = doc.id
        db.add(exc)

        fin_exc = FinancialException(
            business_id=doc.business_id,
            document_id=doc.id,
            exception_type="validation_error",
            severity=exc.severity,
            title=exc.title,
            explanation=exc.explanation,
            suggested_action="Review discrepancies and verify values before CA approval.",
            status="open",
            details={"rule_id": exc.rule_id, "observed": exc.observed_value, "expected": exc.expected_value}
        )
        db.add(fin_exc)

    if new_exceptions:
        doc.status = "needs_review"
        doc.validation_results = [
            {"rule": e.title, "status": "fail", "message": e.explanation}
            for e in new_exceptions
        ]
    else:
        doc.status = "checks_passed"
        doc.validation_results = [
            {"rule": "Validation Checks", "status": "pass", "message": "All layered validation checks passed after correction"}
        ]

    # Workflow Control 6: Record full audit trail preserving before/after values and revision
    audit = AuditEvent(
        organization_id=doc.organization_id,
        firm_id=doc.firm_id or "default_firm",
        action="ca.field_corrected",
        entity_type="document",
        entity_id=doc.id,
        actor_name="CA Hehram",
        details={
            "field": payload.field_name,
            "old_value": old_value,
            "new_value": payload.updated_value,
            "reason": payload.reason,
            "revision": doc.revision,
            "approval_invalidated": was_approved,
            "new_status": doc.status,
            "exceptions_remaining": len(new_exceptions)
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filename = doc.original_filename
    storage_key = doc.storage_key

    # Delete physical file from storage
    storage.delete_file(storage_key, "originals")
    storage.delete_file(storage_key, "quarantine")

    # Record audit event before deleting
    audit = AuditEvent(
        organization_id=doc.organization_id,
        action="ca.document_deleted",
        entity_type="document",
        entity_id=doc.id,
        actor_name="CA Hehram",
        details={"filename": filename, "storage_key": storage_key}
    )
    db.add(audit)

    # Delete database record (cascading deletes pages, fields, exceptions)
    db.delete(doc)
    db.commit()

    return {"status": "success", "id": document_id, "message": f"Document '{filename}' deleted successfully"}


@router.post("/documents/scan-duplicates")
def scan_ledger_duplicates(db: Session = Depends(get_db)):
    """
    Scans all documents across the firm to detect exact, statutory, or financial duplicates.
    Generates duplicate exceptions and updates document metadata.
    """
    from app.models.exception import FinancialException
    from app.services.rule_engine import find_all_duplicate_groups

    docs = db.query(Document).all()
    dup_map = find_all_duplicate_groups(docs)

    duplicates_found = 0
    updated_docs = []

    for doc in docs:
        info = dup_map.get(doc.id, {})
        if info.get("is_duplicate"):
            duplicates_found += 1
            data = dict(doc.extracted_data or {})
            data["duplicate_info"] = {
                "is_duplicate": True,
                "duplicate_of_id": info.get("duplicate_of_id"),
                "duplicate_of_filename": info.get("duplicate_of_filename"),
                "match_reason": info.get("match_reason"),
                "group_size": info.get("group_size", 2)
            }
            doc.extracted_data = data
            doc.status = "needs_review"

            # Check if duplicate exception already exists
            existing_exc = db.query(FinancialException).filter(
                FinancialException.document_id == doc.id,
                FinancialException.exception_type == "duplicate_document"
            ).first()

            if not existing_exc:
                dup_exc = FinancialException(
                    business_id=doc.business_id,
                    document_id=doc.id,
                    exception_type="duplicate_document",
                    severity="high",
                    title="Duplicate Document Detected",
                    explanation=f"Duplicate of '{info.get('duplicate_of_filename')}'. Basis: {info.get('match_reason')}.",
                    suggested_action=f"Review primary document '{info.get('duplicate_of_filename')}' or mark this copy as void.",
                    status="open",
                    details={"matched_doc_id": info.get("duplicate_of_id"), "reason": info.get("match_reason")}
                )
                db.add(dup_exc)

            updated_docs.append({
                "id": doc.id,
                "filename": doc.original_filename,
                "duplicate_of": info.get("duplicate_of_filename"),
                "reason": info.get("match_reason")
            })

    db.commit()
    return {
        "total_documents": len(docs),
        "duplicates_count": duplicates_found,
        "duplicate_items": updated_docs
    }


@router.post("/documents/{document_id}/resolve-duplicate")
def resolve_duplicate_exception(document_id: str, db: Session = Depends(get_db)):
    """Marks duplicate document status as reviewed / resolved by CA."""
    from app.models.exception import FinancialException

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    data = dict(doc.extracted_data or {})
    if "duplicate_info" in data:
        data["duplicate_info"]["resolved"] = True
        data["duplicate_info"]["resolved_by"] = "CA Hehram"
        doc.extracted_data = data

    db.query(FinancialException).filter(
        FinancialException.document_id == document_id,
        FinancialException.exception_type == "duplicate_document"
    ).update({"status": "resolved"})

    # If no other open exceptions remain, set status to checks_passed
    open_excs = db.query(FinancialException).filter(
        FinancialException.document_id == document_id,
        FinancialException.status == "open"
    ).count()
    if open_excs == 0:
        doc.status = "checks_passed"

    db.commit()
    return {"status": "success", "document_id": document_id, "message": "Duplicate exception marked as resolved"}

