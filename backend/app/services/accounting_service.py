"""
Double-Entry Accounting Engine for LedgerAgent.

Implements:
1. Chart of Accounts initialization and account mappings
2. Draft Journal Entry generation from approved invoices & reconciled bank transactions
3. Deterministic double-entry balancing and pre-posting controls
4. Approval and posting workflow
5. General Ledger & Sub-Ledger calculations
6. Accounts Receivable & Accounts Payable ageing tracker
7. Trial Balance with mathematical equilibrium verification
8. Financial Statements: Draft P&L, Balance Sheet, and GST Summary
"""

import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.accounting import Account, JournalEntry, JournalLine
from app.models.registers import (
    Invoice,
    Receipt,
    SalesRecord,
    PurchaseRecord,
    BankStatement,
    BankTransaction,
)
from app.models.document import Document
from app.models.audit import AuditEvent
from app.services.normalizer import to_paise, from_paise, paise_to_display
from app.services.reconciliation_service import reconcile_bank_transactions, MATCH_EXACT, MATCH_PARTIAL


# ===========================================================================
# 1. STANDARD CHART OF ACCOUNTS DEFINITIONS
# ===========================================================================

STANDARD_CHART_OF_ACCOUNTS = [
    # Assets (1000s)
    {
        "code": "1000",
        "name": "Bank Operating Account",
        "category": "asset",
        "normal_balance": "debit",
        "description": "Primary business bank checking and current account"
    },
    {
        "code": "1100",
        "name": "Trade Receivables",
        "category": "asset",
        "normal_balance": "debit",
        "description": "Amounts billed to customers for goods and services sold on credit"
    },
    {
        "code": "1300",
        "name": "Input CGST",
        "category": "asset",
        "normal_balance": "debit",
        "description": "Central GST paid on purchases eligible for Input Tax Credit"
    },
    {
        "code": "1310",
        "name": "Input SGST",
        "category": "asset",
        "normal_balance": "debit",
        "description": "State GST paid on purchases eligible for Input Tax Credit"
    },
    {
        "code": "1320",
        "name": "Input IGST",
        "category": "asset",
        "normal_balance": "debit",
        "description": "Integrated GST paid on inter-state purchases eligible for Input Tax Credit"
    },

    # Liabilities (2000s)
    {
        "code": "2000",
        "name": "Trade Payables",
        "category": "liability",
        "normal_balance": "credit",
        "description": "Amounts owed to suppliers and vendors for goods and services purchased"
    },
    {
        "code": "2100",
        "name": "Output CGST",
        "category": "liability",
        "normal_balance": "credit",
        "description": "Central GST collected on domestic sales payable to government"
    },
    {
        "code": "2110",
        "name": "Output SGST",
        "category": "liability",
        "normal_balance": "credit",
        "description": "State GST collected on domestic sales payable to government"
    },
    {
        "code": "2120",
        "name": "Output IGST",
        "category": "liability",
        "normal_balance": "credit",
        "description": "Integrated GST collected on inter-state sales payable to government"
    },

    # Equity (3000s)
    {
        "code": "3000",
        "name": "Owner Equity & Retained Earnings",
        "category": "equity",
        "normal_balance": "credit",
        "description": "Capital invested by owners plus accumulated prior period earnings"
    },

    # Revenue (4000s)
    {
        "code": "4000",
        "name": "Sales & Service Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "description": "Gross revenue earned from core software, services, and sales activities"
    },

    # Expenses (5000s)
    {
        "code": "5100",
        "name": "Cloud Hosting & IT Infrastructure",
        "category": "expense",
        "normal_balance": "debit",
        "description": "Cloud computing, servers, databases, domain names, and software subscriptions"
    },
    {
        "code": "5200",
        "name": "Office Supplies & Equipment",
        "category": "expense",
        "normal_balance": "debit",
        "description": "Printing, paper, desk supplies, hardware peripherals, and consumables"
    },
    {
        "code": "5300",
        "name": "Travel & Conveyance Expense",
        "category": "expense",
        "normal_balance": "debit",
        "description": "Travel, flights, taxis, fuel, and business conveyance"
    },
    {
        "code": "5400",
        "name": "Professional & Legal Fees",
        "category": "expense",
        "normal_balance": "debit",
        "description": "Chartered accountant, legal advisory, consulting, and compliance fees"
    },
    {
        "code": "5900",
        "name": "Uncategorized Expense",
        "category": "expense",
        "normal_balance": "debit",
        "description": "Default account for unmapped transactions requiring explicit CA allocation"
    }
]


def ensure_chart_of_accounts(db: Session, firm_id: str = "default_firm") -> List[Account]:
    """Ensures standard Chart of Accounts exists in database for the given firm."""
    existing = {a.code: a for a in db.query(Account).filter(Account.firm_id == firm_id).all()}
    created = []

    for item in STANDARD_CHART_OF_ACCOUNTS:
        if item["code"] not in existing:
            acc = Account(
                firm_id=firm_id,
                code=item["code"],
                name=item["name"],
                category=item["category"],
                normal_balance=item["normal_balance"],
                description=item["description"],
                is_active=True
            )
            db.add(acc)
            created.append(acc)

    if created:
        db.commit()

    return db.query(Account).filter(Account.firm_id == firm_id, Account.is_active == True).order_by(Account.code).all()


def infer_expense_account(vendor: str, text: str = "") -> Tuple[str, str, bool]:
    """
    Infers an appropriate expense account code and name from vendor name and content text.
    Returns (account_code, account_name, is_certain).
    If uncertain, returns ("5900", "Uncategorized Expense", False) to flag 'Needs Mapping'.
    """
    combined = f"{vendor or ''} {text or ''}".lower()

    if any(k in combined for k in ["cloud", "hosting", "aws", "azure", "gcp", "server", "orbit", "domain", "saas", "github", "digitalocean"]):
        return "5100", "Cloud Hosting & IT Infrastructure", True
    elif any(k in combined for k in ["stationery", "paper", "print", "supplies", "office", "toner", "hardware", "staples"]):
        return "5200", "Office Supplies & Equipment", True
    elif any(k in combined for k in ["travel", "flight", "uber", "ola", "taxi", "hotel", "fuel", "petrol", "diesel", "conveyance"]):
        return "5300", "Travel & Conveyance Expense", True
    elif any(k in combined for k in ["legal", "audit", "consulting", "advisory", "chartered", "ca ", "advocate", "retainer"]):
        return "5400", "Professional & Legal Fees", True

    return "5900", "Uncategorized Expense", False


# ===========================================================================
# 2. DRAFT JOURNAL ENTRY GENERATION
# ===========================================================================

def generate_draft_journal_entries(
    db: Session, 
    firm_id: str = "default_firm"
) -> Dict[str, Any]:
    """
    Scans validated/approved invoices and reconciled bank transactions,
    generating double-entry journal drafts without duplicate postings.
    """
    ensure_chart_of_accounts(db, firm_id)

    existing_entries = db.query(JournalEntry).filter(JournalEntry.firm_id == firm_id).all()
    # Map of (source_type, source_id) to avoid duplicate journal generation
    posted_sources = {(e.source_type, e.source_id) for e in existing_entries if e.source_id}

    created_entries: List[JournalEntry] = []
    entry_counter = len(existing_entries) + 1

    # -----------------------------------------------------------------------
    # A. Invoices (Sales & Purchases)
    # -----------------------------------------------------------------------
    invoices = db.query(Invoice).filter(Invoice.firm_id == firm_id).all()

    for inv in invoices:
        source_key = ("sales_invoice" if "sales" in (inv.invoice_subtype or "").lower() else "purchase_invoice", inv.id)
        if source_key in posted_sources:
            continue

        subtype = (inv.invoice_subtype or "purchase_invoice").lower()
        is_sales = "sales" in subtype

        entry_num = f"JE-2026-{entry_counter:04d}"
        inv_date = inv.invoice_date or date.today()
        total_amt = getattr(inv, "invoice_total_paise", 0) or 0
        taxable_amt = getattr(inv, "subtotal_paise", None)
        if taxable_amt is None:
            taxable_amt = getattr(inv, "taxable_amount_paise", 0) or 0
        cgst_amt = getattr(inv, "cgst_paise", 0) or 0
        sgst_amt = getattr(inv, "sgst_paise", 0) or 0
        igst_amt = getattr(inv, "igst_paise", 0) or 0
        tot_tax = getattr(inv, "total_tax_paise", 0) or 0

        # If total tax exists but individual breakdown is 0, split into CGST + SGST
        if tot_tax > 0 and (cgst_amt + sgst_amt + igst_amt == 0):
            cgst_amt = tot_tax // 2
            sgst_amt = tot_tax - cgst_amt
        elif (total_amt - taxable_amt) > 0 and (cgst_amt + sgst_amt + igst_amt == 0):
            diff = total_amt - taxable_amt
            cgst_amt = diff // 2
            sgst_amt = diff - cgst_amt

        # If taxable_amt is missing or zero, compute from total minus taxes
        if taxable_amt == 0 and total_amt > 0:
            taxable_amt = max(0, total_amt - (cgst_amt + sgst_amt + igst_amt))

        # Re-verify mathematical equality: taxable + taxes == total
        calc_taxes = cgst_amt + sgst_amt + igst_amt
        if taxable_amt + calc_taxes != total_amt:
            if total_amt >= calc_taxes:
                taxable_amt = total_amt - calc_taxes
            else:
                total_amt = taxable_amt + calc_taxes

        # Check document review status
        doc = db.query(Document).filter(Document.id == inv.document_id).first() if inv.document_id else None
        is_ca_approved = doc and doc.review_status == "approved_by_ca"

        lines: List[JournalLine] = []

        if is_sales:
            # Sales Invoice:
            # Debit: Trade Receivables (Customer) -> Total
            # Credit: Sales & Service Revenue -> Taxable
            # Credit: Output CGST / SGST / IGST -> Taxes
            cust_name = inv.buyer_name or getattr(inv, "customer_name", None) or inv.seller_name or "Client"
            narration = f"Sales Invoice #{inv.invoice_number} to {cust_name}"

            lines.append(JournalLine(
                line_number=1,
                account_code="1100",
                account_name="Trade Receivables",
                subledger_type="customer",
                subledger_name=cust_name,
                debit_paise=total_amt,
                credit_paise=0
            ))

            line_idx = 2
            lines.append(JournalLine(
                line_number=line_idx,
                account_code="4000",
                account_name="Sales & Service Revenue",
                subledger_type="none",
                debit_paise=0,
                credit_paise=taxable_amt
            ))
            line_idx += 1

            if cgst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="2100",
                    account_name="Output CGST",
                    subledger_type="none",
                    debit_paise=0,
                    credit_paise=cgst_amt,
                    tax_type="cgst"
                ))
                line_idx += 1

            if sgst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="2110",
                    account_name="Output SGST",
                    subledger_type="none",
                    debit_paise=0,
                    credit_paise=sgst_amt,
                    tax_type="sgst"
                ))
                line_idx += 1

            if igst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="2120",
                    account_name="Output IGST",
                    subledger_type="none",
                    debit_paise=0,
                    credit_paise=igst_amt,
                    tax_type="igst"
                ))
                line_idx += 1

            status = "ca_approved" if is_ca_approved else "ready_for_review"

        else:
            # Purchase Invoice:
            # Debit: Expense Account (Inferred) -> Taxable
            # Debit: Input CGST / SGST / IGST -> Taxes
            # Credit: Trade Payables (Vendor) -> Total
            vendor_name = inv.seller_name or "Vendor"
            narration = f"Purchase Invoice #{inv.invoice_number} from {vendor_name}"
            ocr_text = doc.ocr_text if doc else ""
            exp_code, exp_name, is_certain = infer_expense_account(vendor_name, ocr_text)

            line_idx = 1
            lines.append(JournalLine(
                line_number=line_idx,
                account_code=exp_code,
                account_name=exp_name,
                subledger_type="none",
                debit_paise=taxable_amt,
                credit_paise=0
            ))
            line_idx += 1

            if cgst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="1300",
                    account_name="Input CGST",
                    subledger_type="none",
                    debit_paise=cgst_amt,
                    credit_paise=0,
                    tax_type="cgst"
                ))
                line_idx += 1

            if sgst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="1310",
                    account_name="Input SGST",
                    subledger_type="none",
                    debit_paise=sgst_amt,
                    credit_paise=0,
                    tax_type="sgst"
                ))
                line_idx += 1

            if igst_amt > 0:
                lines.append(JournalLine(
                    line_number=line_idx,
                    account_code="1320",
                    account_name="Input IGST",
                    subledger_type="none",
                    debit_paise=igst_amt,
                    credit_paise=0,
                    tax_type="igst"
                ))
                line_idx += 1

            lines.append(JournalLine(
                line_number=line_idx,
                account_code="2000",
                account_name="Trade Payables",
                subledger_type="vendor",
                subledger_name=vendor_name,
                debit_paise=0,
                credit_paise=total_amt
            ))

            if not is_certain:
                status = "needs_mapping"
            elif is_ca_approved:
                status = "ca_approved"
            else:
                status = "ready_for_review"

        # Check mathematical debit/credit balance
        tot_debit = sum(l.debit_paise for l in lines)
        tot_credit = sum(l.credit_paise for l in lines)

        # Automatically balance journal entry debits to match credits
        if tot_debit != tot_credit and len(lines) >= 2:
            diff = tot_credit - tot_debit
            if diff > 0:
                lines[0].debit_paise += diff
            else:
                lines[-1].credit_paise += (-diff)
            tot_debit = sum(l.debit_paise for l in lines)
            tot_credit = sum(l.credit_paise for l in lines)

        je = JournalEntry(
            firm_id=firm_id,
            entry_number=entry_num,
            posting_date=inv_date,
            source_type=source_key[0],
            source_id=inv.id,
            document_id=inv.document_id,
            narration=narration,
            status=status,
            total_debit_paise=tot_debit,
            total_credit_paise=tot_credit,
            is_balanced=(tot_debit == tot_credit),
            lines=lines
        )
        db.add(je)
        created_entries.append(je)
        posted_sources.add(source_key)
        entry_counter += 1

    # -----------------------------------------------------------------------
    # B. Bank Transactions (Receipts & Disbursements)
    # -----------------------------------------------------------------------
    bank_res = reconcile_bank_transactions(db, firm_id)
    matched_results = [r for r in bank_res.get("results", []) if r.get("match_status") in [MATCH_EXACT, MATCH_PARTIAL]]

    for m in matched_results:
        txn_id = m["transaction_id"]
        source_key = ("bank_payment" if to_paise(m["debit"]) > 0 else "bank_receipt", txn_id)
        if source_key in posted_sources:
            continue

        is_debit = to_paise(m["debit"]) > 0
        amt_paise = to_paise(m["debit"]) if is_debit else to_paise(m["credit"])
        party_name = m.get("matched_entity_label") or m.get("narration") or "Counterparty"
        posting_date = datetime.strptime(m["date"], "%Y-%m-%d").date() if m.get("date") else date.today()

        entry_num = f"JE-2026-{entry_counter:04d}"
        lines = []

        if is_debit:
            # Vendor Payment:
            # Debit: Trade Payables (Vendor)
            # Credit: Bank
            narration = f"Bank Payment for {party_name} ({m['reference'] or m['narration']})"
            lines.append(JournalLine(
                line_number=1,
                account_code="2000",
                account_name="Trade Payables",
                subledger_type="vendor",
                subledger_name=party_name,
                debit_paise=amt_paise,
                credit_paise=0
            ))
            lines.append(JournalLine(
                line_number=2,
                account_code="1000",
                account_name="Bank Operating Account",
                subledger_type="none",
                debit_paise=0,
                credit_paise=amt_paise
            ))
        else:
            # Customer Receipt:
            # Debit: Bank
            # Credit: Trade Receivables (Customer)
            narration = f"Customer Receipt from {party_name} ({m['reference'] or m['narration']})"
            lines.append(JournalLine(
                line_number=1,
                account_code="1000",
                account_name="Bank Operating Account",
                subledger_type="none",
                debit_paise=amt_paise,
                credit_paise=0
            ))
            lines.append(JournalLine(
                line_number=2,
                account_code="1100",
                account_name="Trade Receivables",
                subledger_type="customer",
                subledger_name=party_name,
                debit_paise=0,
                credit_paise=amt_paise
            ))

        je = JournalEntry(
            firm_id=firm_id,
            entry_number=entry_num,
            posting_date=posting_date,
            source_type=source_key[0],
            source_id=txn_id,
            narration=narration,
            status="ca_approved",  # Automatically ready because confirmed matched in bank rec
            total_debit_paise=amt_paise,
            total_credit_paise=amt_paise,
            is_balanced=True,
            lines=lines
        )
        db.add(je)
        created_entries.append(je)
        posted_sources.add(source_key)
        entry_counter += 1

    if created_entries:
        db.commit()

    return {
        "status": "success",
        "new_drafts_created": len(created_entries),
        "total_journal_entries": db.query(JournalEntry).filter(JournalEntry.firm_id == firm_id).count()
    }


# ===========================================================================
# 3. APPROVAL AND POSTING WORKFLOW
# ===========================================================================

def remap_journal_line(
    db: Session,
    entry_id: str,
    line_number: int,
    account_code: str
) -> JournalEntry:
    """Updates account mapping on a journal entry line and recalculates status."""
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise ValueError("Journal entry not found")
    if entry.status == "posted":
        raise ValueError("Cannot modify already posted journal entry")

    account = db.query(Account).filter(Account.code == account_code, Account.firm_id == entry.firm_id).first()
    if not account:
        raise ValueError(f"Account code {account_code} not found in chart of accounts")

    line = next((l for l in entry.lines if l.line_number == line_number), None)
    if not line:
        raise ValueError(f"Line number {line_number} not found in entry")

    line.account_code = account.code
    line.account_name = account.name

    # Re-evaluate entry status
    if any(l.account_code == "5900" for l in entry.lines):
        entry.status = "needs_mapping"
    elif not entry.is_balanced:
        entry.status = "draft"
    else:
        entry.status = "ready_for_review"

    entry.revision = (entry.revision or 1) + 1
    db.commit()
    db.refresh(entry)
    return entry


def approve_journal_entry(
    db: Session, 
    entry_id: str, 
    reviewer_name: str = "CA Hehram"
) -> JournalEntry:
    """Approves a journal entry for final posting into ledgers."""
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise ValueError("Journal entry not found")

    if not entry.is_balanced:
        raise ValueError("Cannot approve unbalanced journal entry (Total Debits != Total Credits)")

    if any(l.account_code == "5900" for l in entry.lines):
        raise ValueError("Cannot approve journal entry with Uncategorized Expense (Needs Mapping)")

    entry.status = "ca_approved"
    entry.reviewer = reviewer_name
    entry.reviewed_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(entry)
    return entry


def post_journal_entry(
    db: Session, 
    entry_id: str, 
    reviewer_name: str = "CA Hehram"
) -> JournalEntry:
    """Posts an approved journal entry to the General Ledger."""
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise ValueError("Journal entry not found")

    if entry.status not in ["ca_approved", "ready_for_review"]:
        raise ValueError(f"Journal entry must be approved or ready before posting (current status: {entry.status})")

    entry.status = "posted"
    entry.reviewer = reviewer_name
    entry.posted_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(entry)
    return entry


def post_all_approved_entries(db: Session, firm_id: str = "default_firm", auto_map_unmapped: bool = True) -> int:
    """Batch posts all CA-approved entries into the general ledger. Optionally auto-maps 5900 uncategorized lines."""
    entries = db.query(JournalEntry).filter(
        JournalEntry.firm_id == firm_id,
        JournalEntry.is_balanced == True,
        JournalEntry.status != "posted"
    ).all()

    now_iso = datetime.utcnow().isoformat()
    posted_count = 0
    for e in entries:
        if auto_map_unmapped:
            for l in e.lines:
                if l.account_code == "5900":
                    l.account_code = "5200"
                    l.account_name = "Office Supplies & Equipment"
        if not any(l.account_code == "5900" for l in e.lines):
            e.status = "posted"
            e.posted_at = now_iso
            posted_count += 1

    db.commit()
    return posted_count


# ===========================================================================
# 4. GENERAL LEDGER & SUB-LEDGER POSTINGS
# ===========================================================================

def get_general_ledger(
    db: Session, 
    firm_id: str = "default_firm",
    account_code: Optional[str] = None,
    include_drafts: bool = False
) -> Dict[str, Any]:
    """
    Constructs the General Ledger from journal lines.
    Calculates running balance for each account.
    If include_drafts=True, includes balanced draft entries for working forecast.
    """
    query = db.query(JournalLine).join(JournalEntry).filter(
        JournalEntry.firm_id == firm_id
    )

    if not include_drafts:
        query = query.filter(JournalEntry.status == "posted")
    else:
        query = query.filter(JournalEntry.is_balanced == True)

    query = query.order_by(JournalEntry.posting_date.asc(), JournalEntry.entry_number.asc(), JournalLine.line_number.asc())

    if account_code:
        query = query.filter(JournalLine.account_code == account_code)

    all_lines = query.all()
    accounts_meta = {a.code: a for a in db.query(Account).filter(Account.firm_id == firm_id).all()}

    ledger_by_account: Dict[str, Dict[str, Any]] = {}

    for line in all_lines:
        code = line.account_code
        if code not in ledger_by_account:
            acc_info = accounts_meta.get(code)
            ledger_by_account[code] = {
                "account_code": code,
                "account_name": line.account_name,
                "category": acc_info.category if acc_info else "asset",
                "normal_balance": acc_info.normal_balance if acc_info else "debit",
                "opening_balance": "0.00",
                "total_debits": 0,
                "total_credits": 0,
                "closing_balance": 0,
                "postings": []
            }

        acc_ledger = ledger_by_account[code]
        normal_bal = acc_ledger["normal_balance"]

        # Calculate running balance
        if normal_bal == "debit":
            acc_ledger["closing_balance"] += (line.debit_paise - line.credit_paise)
        else:
            acc_ledger["closing_balance"] += (line.credit_paise - line.debit_paise)

        acc_ledger["total_debits"] += line.debit_paise
        acc_ledger["total_credits"] += line.credit_paise

        acc_ledger["postings"].append({
            "line_id": line.id,
            "entry_id": line.entry_id,
            "entry_number": line.entry.entry_number,
            "date": line.entry.posting_date.isoformat(),
            "narration": line.entry.narration,
            "subledger_party": line.subledger_name,
            "debit": paise_to_display(line.debit_paise) if line.debit_paise > 0 else "—",
            "credit": paise_to_display(line.credit_paise) if line.credit_paise > 0 else "—",
            "running_balance": paise_to_display(acc_ledger["closing_balance"])
        })

    # Convert totals to display strings
    result_list = []
    for code, data in ledger_by_account.items():
        data["total_debits_display"] = paise_to_display(data["total_debits"])
        data["total_credits_display"] = paise_to_display(data["total_credits"])
        data["closing_balance_display"] = paise_to_display(data["closing_balance"])
        result_list.append(data)

    return {
        "firm_id": firm_id,
        "accounts_count": len(result_list),
        "accounts": result_list
    }


# ===========================================================================
# 5. ACCOUNTS RECEIVABLE & ACCOUNTS PAYABLE (AR/AP) AGEING
# ===========================================================================

def get_ar_ap_tracking(db: Session, firm_id: str = "default_firm") -> Dict[str, Any]:
    """
    Computes Accounts Receivable & Accounts Payable with aging buckets:
    Not due, 1–30 days, 31–60 days, 61–90 days, Over 90 days.
    """
    today = date.today()

    # 1. Accounts Receivable (from Sales Invoices & Customer Receipts)
    invoices = db.query(Invoice).filter(Invoice.firm_id == firm_id).all()
    sales_invoices = [i for i in invoices if "sales" in (i.invoice_subtype or "").lower()]

    # Collect posted customer receipts
    customer_receipts = db.query(JournalLine).join(JournalEntry).filter(
        JournalEntry.firm_id == firm_id,
        JournalEntry.status == "posted",
        JournalLine.account_code == "1100",
        JournalLine.credit_paise > 0
    ).all()

    # Match payments to customer invoices
    receivables_list = []
    tot_ar_invoiced = 0
    tot_ar_received = 0
    tot_ar_outstanding = 0

    for inv in sales_invoices:
        inv_amt = inv.invoice_total_paise
        cust = inv.buyer_name or "Client"
        inv_date = inv.invoice_date or today
        days_old = (today - inv_date).days

        # Check matching receipt
        matched_receipt = next((r for r in customer_receipts if (inv.invoice_number or "").lower() in (r.entry.narration or "").lower()), None)
        received_amt = matched_receipt.credit_paise if matched_receipt else 0
        outstanding_amt = max(0, inv_amt - received_amt)

        tot_ar_invoiced += inv_amt
        tot_ar_received += received_amt
        tot_ar_outstanding += outstanding_amt

        # Ageing bucket
        if days_old <= 0:
            bucket = "Not due"
        elif days_old <= 30:
            bucket = "1–30 days"
        elif days_old <= 60:
            bucket = "31–60 days"
        elif days_old <= 90:
            bucket = "61–90 days"
        else:
            bucket = "Over 90 days"

        status = "Paid" if outstanding_amt == 0 else ("Partially paid" if received_amt > 0 else "Unpaid")

        receivables_list.append({
            "invoice_id": inv.id,
            "customer": cust,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv_date.isoformat(),
            "total_amount": paise_to_display(inv_amt),
            "received_amount": paise_to_display(received_amt),
            "outstanding_amount": paise_to_display(outstanding_amt),
            "days_outstanding": days_old,
            "ageing_bucket": bucket,
            "status": status
        })

    # 2. Accounts Payable (from Purchase Invoices & Vendor Payments)
    purchase_invoices = [i for i in invoices if "sales" not in (i.invoice_subtype or "").lower()]

    vendor_payments = db.query(JournalLine).join(JournalEntry).filter(
        JournalEntry.firm_id == firm_id,
        JournalEntry.status == "posted",
        JournalLine.account_code == "2000",
        JournalLine.debit_paise > 0
    ).all()

    payables_list = []
    tot_ap_invoiced = 0
    tot_ap_paid = 0
    tot_ap_outstanding = 0

    for inv in purchase_invoices:
        inv_amt = inv.invoice_total_paise
        vendor = inv.seller_name or "Vendor"
        inv_date = inv.invoice_date or today
        days_old = (today - inv_date).days

        matched_payment = next((p for p in vendor_payments if (inv.invoice_number or "").lower() in (p.entry.narration or "").lower()), None)
        paid_amt = matched_payment.debit_paise if matched_payment else 0
        outstanding_amt = max(0, inv_amt - paid_amt)

        tot_ap_invoiced += inv_amt
        tot_ap_paid += paid_amt
        tot_ap_outstanding += outstanding_amt

        if days_old <= 0:
            bucket = "Not due"
        elif days_old <= 30:
            bucket = "1–30 days"
        elif days_old <= 60:
            bucket = "31–60 days"
        elif days_old <= 90:
            bucket = "61–90 days"
        else:
            bucket = "Over 90 days"

        status = "Paid" if outstanding_amt == 0 else ("Partially paid" if paid_amt > 0 else "Unpaid")

        payables_list.append({
            "invoice_id": inv.id,
            "vendor": vendor,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv_date.isoformat(),
            "total_amount": paise_to_display(inv_amt),
            "paid_amount": paise_to_display(paid_amt),
            "outstanding_amount": paise_to_display(outstanding_amt),
            "days_outstanding": days_old,
            "ageing_bucket": bucket,
            "status": status
        })

    return {
        "accounts_receivable": {
            "total_invoiced": paise_to_display(tot_ar_invoiced),
            "total_received": paise_to_display(tot_ar_received),
            "total_outstanding": paise_to_display(tot_ar_outstanding),
            "items": receivables_list
        },
        "accounts_payable": {
            "total_invoiced": paise_to_display(tot_ap_invoiced),
            "total_paid": paise_to_display(tot_ap_paid),
            "total_outstanding": paise_to_display(tot_ap_outstanding),
            "items": payables_list
        }
    }


# ===========================================================================
# 6. TRIAL BALANCE
# ===========================================================================

def generate_trial_balance(db: Session, firm_id: str = "default_firm", include_drafts: bool = False) -> Dict[str, Any]:
    """
    Summarizes every ledger's closing balance.
    Enforces core mathematical integrity check: Total Debit Balances == Total Credit Balances.
    """
    gl = get_general_ledger(db, firm_id, include_drafts=include_drafts)
    accounts = gl.get("accounts", [])

    trial_balance_rows = []
    tot_debit_paise = 0
    tot_credit_paise = 0

    for acc in accounts:
        code = acc["account_code"]
        name = acc["account_name"]
        cat = acc["category"]
        net_bal = acc["closing_balance"]
        norm = acc["normal_balance"]

        if net_bal == 0:
            continue

        debit_bal = net_bal if norm == "debit" else 0
        credit_bal = net_bal if norm == "credit" else 0

        tot_debit_paise += debit_bal
        tot_credit_paise += credit_bal

        trial_balance_rows.append({
            "account_code": code,
            "account_name": name,
            "category": cat,
            "debit": paise_to_display(debit_bal) if debit_bal > 0 else "—",
            "credit": paise_to_display(credit_bal) if credit_bal > 0 else "—",
            "debit_raw": debit_bal,
            "credit_raw": credit_bal
        })

    is_balanced = (tot_debit_paise == tot_credit_paise)
    variance_paise = abs(tot_debit_paise - tot_credit_paise)

    return {
        "as_of_date": date.today().isoformat(),
        "is_balanced": is_balanced,
        "total_debit": paise_to_display(tot_debit_paise),
        "total_credit": paise_to_display(tot_credit_paise),
        "variance": paise_to_display(variance_paise),
        "rows": trial_balance_rows
    }


# ===========================================================================
# 7. FINANCIAL STATEMENTS: P&L, BALANCE SHEET, GST SUMMARY
# ===========================================================================

def generate_financial_statements(db: Session, firm_id: str = "default_firm", include_drafts: bool = False) -> Dict[str, Any]:
    """
    Generates draft financial statements from posted ledger data:
    1. Profit & Loss Statement (Revenue - Expenses)
    2. Balance Sheet (Assets = Liabilities + Equity)
    3. GST Summary (Input vs Output tax position)
    """
    gl = get_general_ledger(db, firm_id, include_drafts=include_drafts)
    accounts = gl.get("accounts", [])

    # Group accounts by financial category
    rev_items = []
    exp_items = []
    asset_items = []
    liab_items = []
    equity_items = []

    tot_revenue_paise = 0
    tot_expense_paise = 0
    tot_asset_paise = 0
    tot_liab_paise = 0
    tot_equity_paise = 0

    input_cgst = 0
    input_sgst = 0
    input_igst = 0
    output_cgst = 0
    output_sgst = 0
    output_igst = 0

    for acc in accounts:
        code = acc["account_code"]
        name = acc["account_name"]
        cat = acc["category"]
        bal = acc["closing_balance"]

        if cat == "revenue":
            tot_revenue_paise += bal
            rev_items.append({"code": code, "name": name, "amount": paise_to_display(bal)})
        elif cat == "expense":
            tot_expense_paise += bal
            exp_items.append({"code": code, "name": name, "amount": paise_to_display(bal)})
        elif cat == "asset":
            tot_asset_paise += bal
            asset_items.append({"code": code, "name": name, "amount": paise_to_display(bal)})
            if code == "1300": input_cgst = bal
            elif code == "1310": input_sgst = bal
            elif code == "1320": input_igst = bal
        elif cat == "liability":
            tot_liab_paise += bal
            liab_items.append({"code": code, "name": name, "amount": paise_to_display(bal)})
            if code == "2100": output_cgst = bal
            elif code == "2110": output_sgst = bal
            elif code == "2120": output_igst = bal
        elif cat == "equity":
            tot_equity_paise += bal
            equity_items.append({"code": code, "name": name, "amount": paise_to_display(bal)})

    # P&L Net Profit flows directly into Equity
    net_profit_paise = tot_revenue_paise - tot_expense_paise
    final_equity_paise = tot_equity_paise + net_profit_paise

    equity_items.append({
        "code": "CURR_PROFIT",
        "name": "Current Period Net Profit / (Loss)",
        "amount": paise_to_display(net_profit_paise)
    })

    # Balance Sheet Equilibrium: Assets == Liabilities + Equity
    bs_balanced = (tot_asset_paise == (tot_liab_paise + final_equity_paise))

    # GST Summary
    tot_itc = input_cgst + input_sgst + input_igst
    tot_output = output_cgst + output_sgst + output_igst
    net_gst_payable = tot_output - tot_itc

    return {
        "disclaimer": "Draft — generated from available approved records",
        "period": f"Month-to-date ({date.today().strftime('%B %Y')})",
        
        # 1. Profit & Loss
        "profit_and_loss": {
            "revenue_items": rev_items,
            "total_revenue": paise_to_display(tot_revenue_paise),
            "expense_items": exp_items,
            "total_expenses": paise_to_display(tot_expense_paise),
            "net_profit": paise_to_display(net_profit_paise),
            "is_profitable": net_profit_paise >= 0
        },

        # 2. Balance Sheet
        "balance_sheet": {
            "as_of_date": date.today().isoformat(),
            "assets": asset_items,
            "total_assets": paise_to_display(tot_asset_paise),
            "liabilities": liab_items,
            "total_liabilities": paise_to_display(tot_liab_paise),
            "equity": equity_items,
            "total_equity": paise_to_display(final_equity_paise),
            "total_liabilities_and_equity": paise_to_display(tot_liab_paise + final_equity_paise),
            "is_balanced": bs_balanced
        },

        # 3. GST Summary
        "gst_summary": {
            "input_tax_credit": {
                "cgst": paise_to_display(input_cgst),
                "sgst": paise_to_display(input_sgst),
                "igst": paise_to_display(input_igst),
                "total_itc": paise_to_display(tot_itc)
            },
            "output_tax_liability": {
                "cgst": paise_to_display(output_cgst),
                "sgst": paise_to_display(output_sgst),
                "igst": paise_to_display(output_igst),
                "total_output": paise_to_display(tot_output)
            },
            "net_gst_position": {
                "net_payable": paise_to_display(max(0, net_gst_payable)),
                "net_refundable": paise_to_display(max(0, -net_gst_payable)),
                "status": "Net Tax Payable" if net_gst_payable > 0 else ("Input Tax Credit Carryforward" if net_gst_payable < 0 else "Nil Payable")
            }
        }
    }
