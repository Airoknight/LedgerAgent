"""
API Endpoints for Cross-Document Reconciliation (Registers & Bank Statements).
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.exception import FinancialException
from app.models.validation_exception import ValidationException
from app.services.reconciliation_service import (
    compare_invoices_with_registers,
    reconcile_bank_transactions,
)

router = APIRouter(prefix="/reconciliation", tags=["Reconciliation & Cross-Document Checks"])


@router.get("/status")
def get_reconciliation_status(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """
    Returns an aggregated summary of cross-register comparisons and bank reconciliation.
    """
    bank_summary = reconcile_bank_transactions(db=db, firm_id=firm_id)
    register_exceptions = compare_invoices_with_registers(db=db, firm_id=firm_id)

    return {
        "bank_reconciliation": {
            "total_transactions": bank_summary["total_transactions"],
            "matched_count": bank_summary["matched_count"],
            "unmatched_count": bank_summary["unmatched_count"],
            "match_percentage": bank_summary["match_percentage"],
            "unsupported_payments_count": len(bank_summary["exceptions"])
        },
        "register_reconciliation": {
            "discrepancies_count": len(register_exceptions),
            "discrepancies": [
                {
                    "rule_id": e.rule_id,
                    "title": e.title,
                    "severity": e.severity,
                    "explanation": e.explanation,
                    "observed": e.observed_value,
                    "expected": e.expected_value
                }
                for e in register_exceptions
            ]
        }
    }


@router.get("/bank")
def get_bank_reconciliation(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """
    Returns detailed bank statement transactions alongside their reconciliation matching status.
    """
    return reconcile_bank_transactions(db=db, firm_id=firm_id)


@router.get("/registers")
def get_register_discrepancies(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """
    Compares uploaded invoices against sales and purchase registers and returns discrepancies.
    """
    exceptions = compare_invoices_with_registers(db=db, firm_id=firm_id)
    return [
        {
            "document_id": e.document_id,
            "record_id": e.record_id,
            "rule_id": e.rule_id,
            "title": e.title,
            "severity": e.severity,
            "explanation": e.explanation,
            "observed_value": e.observed_value,
            "expected_value": e.expected_value,
            "details": e.details_json
        }
        for e in exceptions
    ]


@router.post("/run")
def run_full_reconciliation(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """
    Runs both cross-register comparison and bank reconciliation,
    persisting any newly discovered exceptions into the database.
    """
    # 1. Cross-register check
    register_exceptions = compare_invoices_with_registers(db=db, firm_id=firm_id)
    
    # 2. Bank reconciliation
    bank_res = reconcile_bank_transactions(db=db, firm_id=firm_id)
    bank_exceptions = bank_res["exceptions"]

    all_new_exceptions = register_exceptions + bank_exceptions
    created_count = 0

    for exc in all_new_exceptions:
        # Check if already present to avoid duplicates
        existing = db.query(ValidationException).filter(
            ValidationException.firm_id == exc.firm_id,
            ValidationException.rule_id == exc.rule_id,
            ValidationException.document_id == exc.document_id
        ).first()

        if not existing:
            db.add(exc)
            created_count += 1

            # Also create corresponding FinancialException for backwards compatibility
            fin_exc = FinancialException(
                business_id=None,
                document_id=exc.document_id,
                exception_type="reconciliation_mismatch",
                severity=exc.severity,
                title=exc.title,
                explanation=exc.explanation,
                suggested_action="Review cross-record reconciliation and resolve discrepancy before final CA approval.",
                status="open",
                details={"rule_id": exc.rule_id, "observed": exc.observed_value, "expected": exc.expected_value}
            )
            db.add(fin_exc)

    db.commit()

    return {
        "status": "success",
        "new_exceptions_created": created_count,
        "register_discrepancies_count": len(register_exceptions),
        "bank_matched_count": bank_res["matched_count"],
        "bank_unmatched_count": bank_res["unmatched_count"],
        "bank_match_percentage": bank_res["match_percentage"]
    }
