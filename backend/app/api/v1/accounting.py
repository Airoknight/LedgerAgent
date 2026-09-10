"""
API Endpoints for Double-Entry Accounting: Journals, Ledgers, Trial Balance, and Financial Statements.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.accounting import Account, JournalEntry, JournalLine
from app.services.accounting_service import (
    ensure_chart_of_accounts,
    generate_draft_journal_entries,
    remap_journal_line,
    approve_journal_entry,
    post_journal_entry,
    post_all_approved_entries,
    get_general_ledger,
    get_ar_ap_tracking,
    generate_trial_balance,
    generate_financial_statements,
)
from app.services.normalizer import paise_to_display

router = APIRouter(prefix="/accounting", tags=["Accounting & Financial Statements"])

class RemapAccountRequest(BaseModel):
    account_code: str


@router.get("/coa")
def list_chart_of_accounts(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """Returns the active Chart of Accounts."""
    accounts = ensure_chart_of_accounts(db, firm_id)
    return [
        {
            "id": a.id,
            "code": a.code,
            "name": a.name,
            "category": a.category,
            "normal_balance": a.normal_balance,
            "description": a.description,
            "is_active": a.is_active
        }
        for a in accounts
    ]


@router.get("/journal-entries")
def list_journal_entries(
    status: Optional[str] = None,
    firm_id: str = "default_firm",
    db: Session = Depends(get_db)
):
    """Lists journal entries with line breakdown."""
    query = db.query(JournalEntry).filter(JournalEntry.firm_id == firm_id)
    if status:
        query = query.filter(JournalEntry.status == status)

    entries = query.order_by(JournalEntry.posting_date.desc(), JournalEntry.entry_number.desc()).all()

    result = []
    for e in entries:
        result.append({
            "id": e.id,
            "entry_number": e.entry_number,
            "posting_date": e.posting_date.isoformat() if e.posting_date else None,
            "source_type": e.source_type,
            "source_id": e.source_id,
            "document_id": e.document_id,
            "narration": e.narration,
            "status": e.status,
            "total_debit": paise_to_display(e.total_debit_paise),
            "total_credit": paise_to_display(e.total_credit_paise),
            "is_balanced": e.is_balanced,
            "reviewer": e.reviewer,
            "reviewed_at": e.reviewed_at,
            "posted_at": e.posted_at,
            "revision": e.revision,
            "lines": [
                {
                    "line_number": l.line_number,
                    "account_code": l.account_code,
                    "account_name": l.account_name,
                    "subledger_type": l.subledger_type,
                    "subledger_name": l.subledger_name,
                    "debit": paise_to_display(l.debit_paise) if l.debit_paise > 0 else "—",
                    "credit": paise_to_display(l.credit_paise) if l.credit_paise > 0 else "—",
                    "tax_type": l.tax_type
                }
                for l in e.lines
            ]
        })
    return result


@router.post("/generate-drafts")
def generate_drafts(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """
    Transforms approved invoices and reconciled bank transactions into draft double-entry journal entries.
    """
    return generate_draft_journal_entries(db, firm_id)


@router.put("/journal-entries/{entry_id}/lines/{line_number}/map")
def remap_line_account(
    entry_id: str,
    line_number: int,
    payload: RemapAccountRequest,
    db: Session = Depends(get_db)
):
    """Allows CA to remap an account on a journal entry line (e.g. from 5900 Uncategorized)."""
    try:
        je = remap_journal_line(db, entry_id, line_number, payload.account_code)
        return {
            "status": "success", 
            "id": je.id, 
            "entry_number": je.entry_number, 
            "new_status": je.status,
            "revision": je.revision
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/journal-entries/{entry_id}/approve")
def approve_entry(
    entry_id: str, 
    reviewer_name: str = "CA Hehram",
    db: Session = Depends(get_db)
):
    """Approves a draft journal entry."""
    try:
        je = approve_journal_entry(db, entry_id, reviewer_name)
        return {"status": "success", "id": je.id, "entry_number": je.entry_number, "new_status": je.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/journal-entries/{entry_id}/post")
def post_entry(
    entry_id: str, 
    reviewer_name: str = "CA Hehram",
    db: Session = Depends(get_db)
):
    """Posts an approved journal entry to the general ledger."""
    try:
        je = post_journal_entry(db, entry_id, reviewer_name)
        return {"status": "success", "id": je.id, "entry_number": je.entry_number, "new_status": je.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/post-all")
def post_all_entries(firm_id: str = "default_firm", db: Session = Depends(get_db)):
    """Batch posts all approved journal entries to the general ledger."""
    count = post_all_approved_entries(db, firm_id)
    return {"status": "success", "posted_count": count}


@router.get("/ledgers")
def list_general_ledgers(
    account_code: Optional[str] = None,
    firm_id: str = "default_firm",
    db: Session = Depends(get_db)
):
    """Returns General Ledger accounts with movements and running balance."""
    return get_general_ledger(db, firm_id, account_code)


@router.get("/ar-ap")
def get_accounts_receivable_payable(
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Returns Accounts Receivable and Accounts Payable with ageing buckets."""
    return get_ar_ap_tracking(db, firm_id)


@router.get("/trial-balance")
def get_trial_balance_report(
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Returns the Trial Balance and verifies Total Debits == Total Credits."""
    return generate_trial_balance(db, firm_id)


@router.get("/financial-statements")
def get_financial_statements_report(
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Generates draft Profit & Loss, Balance Sheet, and GST Summary."""
    return generate_financial_statements(db, firm_id)
