"""
API Endpoints for Double-Entry Accounting: Journals, Ledgers, Trial Balance, and Financial Statements.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from datetime import datetime, date
from app.core.database import get_db
from app.models.document import Document
from app.models.registers import Invoice
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

class ConfirmIntakeRequest(BaseModel):
    document_id: str
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    party_name: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    target_account_code: Optional[str] = "5200"


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
def post_all_entries(
    firm_id: str = "default_firm", 
    auto_map: bool = Query(True), 
    db: Session = Depends(get_db)
):
    """Batch posts all approved journal entries to the general ledger, auto-mapping any unallocated lines to operating expenses."""
    count = post_all_approved_entries(db, firm_id, auto_map_unmapped=auto_map)
    return {"status": "success", "posted_count": count}


@router.get("/ledgers")
def list_general_ledgers(
    account_code: Optional[str] = None,
    include_drafts: bool = Query(False),
    firm_id: str = "default_firm",
    db: Session = Depends(get_db)
):
    """Returns General Ledger accounts with movements and running balance."""
    return get_general_ledger(db, firm_id, account_code, include_drafts=include_drafts)


@router.get("/ar-ap")
def get_accounts_receivable_payable(
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Returns Accounts Receivable and Accounts Payable with ageing buckets."""
    return get_ar_ap_tracking(db, firm_id)


@router.get("/trial-balance")
def get_trial_balance_report(
    include_drafts: bool = Query(False),
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Returns the Trial Balance and verifies Total Debits == Total Credits."""
    return generate_trial_balance(db, firm_id, include_drafts=include_drafts)


@router.get("/financial-statements")
def get_financial_statements_report(
    include_drafts: bool = Query(False),
    firm_id: str = "default_firm", 
    db: Session = Depends(get_db)
):
    """Generates draft Profit & Loss, Balance Sheet, and GST Summary."""
    return generate_financial_statements(db, firm_id, include_drafts=include_drafts)


@router.post("/confirm-intake")
def confirm_intake_and_post(
    payload: ConfirmIntakeRequest,
    firm_id: str = "default_firm",
    db: Session = Depends(get_db)
):
    """
    Called after upload: Updates user-confirmed fields on document & register,
    approves document, generates balanced double-entry journal, and posts to ledger.
    """
    doc = db.query(Document).filter(Document.id == payload.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ext_data = (doc.extracted_data or {}).copy()
    if payload.invoice_number:
        ext_data["invoice_number"] = payload.invoice_number
        ext_data["identifier"] = payload.invoice_number
    if payload.date:
        ext_data["invoice_date"] = payload.date
        ext_data["date"] = payload.date
    if payload.party_name:
        ext_data["vendor_name"] = payload.party_name
        ext_data["seller_name"] = payload.party_name
        ext_data["party_name"] = payload.party_name
    if payload.subtotal is not None:
        ext_data["subtotal"] = payload.subtotal
        ext_data["taxable_amount"] = payload.subtotal
    if payload.tax is not None:
        ext_data["tax_total"] = payload.tax
        ext_data["tax"] = payload.tax
        ext_data["cgst"] = payload.tax / 2
        ext_data["sgst"] = payload.tax / 2
    if payload.total is not None:
        ext_data["grand_total"] = payload.total
        ext_data["total"] = payload.total

    doc.extracted_data = ext_data
    doc.review_status = "approved_by_ca"
    doc.status = "checks_passed"
    doc.reviewed_by = "CA Hehram"

    # Also update or create the normalized Invoice record
    inv = db.query(Invoice).filter(Invoice.document_id == doc.id).first()
    subtotal_paise = int((payload.subtotal if payload.subtotal is not None else float(ext_data.get("subtotal") or 0)) * 100)
    total_paise = int((payload.total if payload.total is not None else float(ext_data.get("grand_total") or ext_data.get("total") or 0)) * 100)
    tax_paise = int((payload.tax if payload.tax is not None else float(ext_data.get("tax_total") or 0)) * 100)
    if tax_paise == 0 and total_paise > subtotal_paise:
        tax_paise = total_paise - subtotal_paise

    cgst_paise = tax_paise // 2
    sgst_paise = tax_paise - cgst_paise

    if inv:
        if payload.invoice_number: inv.invoice_number = payload.invoice_number
        if payload.party_name: inv.seller_name = payload.party_name
        inv.subtotal_paise = subtotal_paise
        inv.cgst_paise = cgst_paise
        inv.sgst_paise = sgst_paise
        inv.total_tax_paise = tax_paise
        inv.invoice_total_paise = total_paise
    else:
        inv_dt = date.today()
        if payload.date:
            try:
                inv_dt = datetime.strptime(payload.date, "%Y-%m-%d").date()
            except Exception:
                pass
        inv = Invoice(
            document_id=doc.id,
            firm_id=firm_id,
            invoice_subtype="purchase_invoice",
            invoice_number=payload.invoice_number or ext_data.get("invoice_number", "INV-NEW"),
            invoice_date=inv_dt,
            seller_name=payload.party_name or ext_data.get("vendor_name", "Vendor"),
            subtotal_paise=subtotal_paise,
            cgst_paise=cgst_paise,
            sgst_paise=sgst_paise,
            total_tax_paise=tax_paise,
            invoice_total_paise=total_paise
        )
        db.add(inv)

    db.commit()

    # Generate draft double-entry journal
    generate_draft_journal_entries(db, firm_id)

    # Assign target account code (e.g. 5100, 5200, 5300, 5400, 4000)
    target_code = payload.target_account_code or "5200"
    target_acc = db.query(Account).filter(Account.code == target_code, Account.firm_id == firm_id).first()
    target_name = target_acc.name if target_acc else "Office Supplies & Equipment"

    je = db.query(JournalEntry).filter(JournalEntry.document_id == doc.id).first()
    if je:
        for l in je.lines:
            if l.account_code in ["5900", "5200", "5100", "5300", "5400", "4000"]:
                l.account_code = target_code
                l.account_name = target_name
        je.status = "posted"
        je.posted_at = datetime.utcnow().isoformat()
        db.commit()

    # Synchronize all approved entries into the general ledger
    post_all_approved_entries(db, firm_id, auto_map_unmapped=True)

    return {
        "status": "success",
        "document_id": doc.id,
        "journal_entry_id": je.id if je else None,
        "entry_number": je.entry_number if je else None,
        "posted": True
    }
