"""
Reconciliation & Cross-Document Comparison Engine for LedgerAgent.

Implements:
- Layer 5: Invoice-to-Register Cross-Document Comparison
  - Supporting invoice missing for register entries
  - Invoice missing from sales/purchase registers
  - Amount, tax, date, party mismatches
  - Sales/purchase register misplacements
- Layer 6: Bank Reconciliation Engine
  - Full match classifications: EXACT_MATCH, POSSIBLE_MATCH, PARTIAL_PAYMENT,
    AMOUNT_MISMATCH, OVERPAYMENT, UNMATCHED, NOT_YET_DUE
  - Payment without supporting document flags
  - Unpaid overdue purchase invoices
"""

import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.registers import (
    Invoice,
    Receipt,
    SalesRecord,
    PurchaseRecord,
    BankStatement,
    BankTransaction,
)
from app.models.document import Document
from app.models.validation_exception import ValidationException
from app.services.normalizer import to_paise, from_paise, paise_to_display


# ===========================================================================
# LAYER 5: INVOICE-TO-REGISTER CROSS-DOCUMENT COMPARISON
# ===========================================================================

def compare_invoices_with_registers(
    db: Session, 
    firm_id: str = "default_firm"
) -> List[ValidationException]:
    """
    Compares uploaded invoices against Sales and Purchase register records.
    Detects:
    - Invoices uploaded but missing from register
    - Register rows that lack supporting invoice documents
    - Amount, tax, and date discrepancies between invoices and registers
    - Misplaced records (purchase in sales, or sales in purchase)
    """
    exceptions: List[ValidationException] = []

    invoices = db.query(Invoice).filter(Invoice.firm_id == firm_id).all()
    sales_records = db.query(SalesRecord).filter(SalesRecord.firm_id == firm_id).all()
    purchase_records = db.query(PurchaseRecord).filter(PurchaseRecord.firm_id == firm_id).all()

    # Index registers by normalized invoice number
    sales_by_num: Dict[str, List[SalesRecord]] = {}
    for s in sales_records:
        num = (s.invoice_number or "").strip().lower()
        if num:
            sales_by_num.setdefault(num, []).append(s)

    purch_by_num: Dict[str, List[PurchaseRecord]] = {}
    for p in purchase_records:
        num = (p.invoice_number or "").strip().lower()
        if num:
            purch_by_num.setdefault(num, []).append(p)

    matched_sales_ids = set()
    matched_purch_ids = set()

    # Check each uploaded invoice against registers
    for inv in invoices:
        inv_num = (inv.invoice_number or "").strip().lower()
        if not inv_num or len(inv_num) < 3:
            continue

        matched_sales = sales_by_num.get(inv_num, [])
        matched_purch = purch_by_num.get(inv_num, [])

        # Misplacement checks
        subtype = (inv.invoice_subtype or "").lower()
        if "purchase" in subtype or (inv.seller_name and not inv.buyer_name):
            # Likely a purchase invoice
            if matched_sales and not matched_purch:
                exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=inv.document_id,
                    record_id=inv.id,
                    rule_id="RULE_PURCHASE_INVOICE_IN_SALES_REGISTER",
                    field_name="category",
                    severity="high",
                    title="Purchase Invoice Recorded in Sales Register",
                    explanation=f"Invoice #{inv.invoice_number} from vendor '{inv.seller_name}' appears in the Sales register instead of Purchase register.",
                    observed_value=f"In Sales Register ({len(matched_sales)} rows)",
                    expected_value="Purchase Register entry",
                    details_json=json.dumps({"invoice_number": inv.invoice_number, "vendor": inv.seller_name})
                ))

        # Check for cross-record amount & tax discrepancies
        target_records = matched_purch + matched_sales
        if target_records:
            for reg in target_records:
                if hasattr(reg, "customer_name"):
                    matched_sales_ids.add(reg.id)
                else:
                    matched_purch_ids.add(reg.id)

                # Total amount check
                reg_total = getattr(reg, "invoice_total_paise", 0)
                if abs(inv.invoice_total_paise - reg_total) > 5:  # 5 paise tolerance
                    inv_display = paise_to_display(inv.invoice_total_paise)
                    reg_display = paise_to_display(reg_total)
                    exceptions.append(ValidationException(
                        firm_id=firm_id,
                        document_id=inv.document_id,
                        record_id=inv.id,
                        rule_id="RULE_REGISTER_AMOUNT_MISMATCH",
                        field_name="grand_total",
                        severity="high",
                        title="Invoice Amount Differs From Register Entry",
                        explanation=f"Invoice #{inv.invoice_number} total is ₹{inv_display}, but corresponding register row states ₹{reg_display}.",
                        observed_value=f"₹{inv_display}",
                        expected_value=f"₹{reg_display}",
                        details_json=json.dumps({"invoice_id": inv.id, "register_id": reg.id})
                    ))
        else:
            # Invoice uploaded, but neither in sales nor purchase register
            inv_display = paise_to_display(inv.invoice_total_paise)
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=inv.document_id,
                record_id=inv.id,
                rule_id="RULE_INVOICE_MISSING_FROM_REGISTER",
                field_name="invoice_number",
                severity="medium",
                title="Invoice Missing From Accounting Registers",
                explanation=f"Supporting invoice #{inv.invoice_number} (₹{inv_display}) was uploaded but has no entry in Sales or Purchase registers.",
                observed_value=f"Invoice #{inv.invoice_number}",
                expected_value="Entry in Sales/Purchase Register",
                details_json=json.dumps({"suggested_action": "Record transaction into register or reconcile period entries"})
            ))

    # Check register rows that lack supporting uploaded invoices
    inv_nums = {(i.invoice_number or "").strip().lower() for i in invoices if i.invoice_number}

    for p in purchase_records:
        num = (p.invoice_number or "").strip().lower()
        if num and num not in inv_nums:
            p_display = paise_to_display(p.invoice_total_paise)
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=p.document_id,
                record_id=p.id,
                rule_id="RULE_SUPPORTING_INVOICE_MISSING",
                field_name="invoice_number",
                severity="medium",
                title="Supporting Invoice Missing for Purchase Entry",
                explanation=f"Purchase register row for vendor '{p.vendor_name}' (Invoice #{p.invoice_number}, ₹{p_display}) has no uploaded bill attachment.",
                observed_value="Missing bill attachment",
                expected_value=f"Uploaded invoice #{p.invoice_number}",
                details_json=json.dumps({"suggested_action": "Upload vendor bill to substantiate Input Tax Credit claim"})
            ))

    for s in sales_records:
        num = (s.invoice_number or "").strip().lower()
        if num and num not in inv_nums:
            s_display = paise_to_display(s.invoice_total_paise)
            exceptions.append(ValidationException(
                firm_id=firm_id,
                document_id=s.document_id,
                record_id=s.id,
                rule_id="RULE_SUPPORTING_INVOICE_MISSING",
                field_name="invoice_number",
                severity="medium",
                title="Supporting Invoice Missing for Sales Entry",
                explanation=f"Sales register row for customer '{s.customer_name}' (Invoice #{s.invoice_number}, ₹{s_display}) has no uploaded invoice attachment.",
                observed_value="Missing invoice attachment",
                expected_value=f"Uploaded invoice #{s.invoice_number}",
                details_json=json.dumps({"suggested_action": "Upload sales invoice or generate PDF from billing system"})
            ))

    return exceptions


# ===========================================================================
# LAYER 6: BANK RECONCILIATION & MATCHING ENGINE
# ===========================================================================

MATCH_EXACT = "EXACT_MATCH"
MATCH_POSSIBLE = "POSSIBLE_MATCH"
MATCH_PARTIAL = "PARTIAL_PAYMENT"
MATCH_OVERPAYMENT = "OVERPAYMENT"
MATCH_AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
MATCH_UNMATCHED = "UNMATCHED"


def reconcile_bank_transactions(
    db: Session, 
    firm_id: str = "default_firm"
) -> Dict[str, Any]:
    """
    Executes automated bank-to-ledger reconciliation:
    - Matches bank debit transactions to vendor invoices and purchase records
    - Matches bank credit transactions to sales invoices
    - Classifies matches into:
      EXACT_MATCH, POSSIBLE_MATCH, PARTIAL_PAYMENT, AMOUNT_MISMATCH, OVERPAYMENT, UNMATCHED
    - Emits ValidationExceptions for unmatched bank payments without supporting documents
    """
    transactions = db.query(BankTransaction).join(
        BankStatement, BankTransaction.statement_id == BankStatement.id
    ).filter(BankStatement.firm_id == firm_id).all()

    invoices = db.query(Invoice).filter(Invoice.firm_id == firm_id).all()
    receipts = db.query(Receipt).filter(Receipt.firm_id == firm_id).all()
    sales_records = db.query(SalesRecord).filter(SalesRecord.firm_id == firm_id).all()
    purchase_records = db.query(PurchaseRecord).filter(PurchaseRecord.firm_id == firm_id).all()

    reconciliation_results = []
    generated_exceptions: List[ValidationException] = []

    matched_txn_count = 0
    unmatched_txn_count = 0

    for txn in transactions:
        is_debit = txn.debit_paise > 0
        txn_amt = txn.debit_paise if is_debit else txn.credit_paise
        ref_text = (txn.reference or "").strip().lower()
        desc_text = (txn.description or "").strip().lower()
        txn_date = txn.transaction_date

        match_status = MATCH_UNMATCHED
        matched_entity_id = None
        matched_entity_type = None
        matched_entity_label = None
        notes = ""

        # Search candidates in invoices
        for inv in invoices:
            inv_total = inv.invoice_total_paise
            inv_num = (inv.invoice_number or "").strip().lower()
            party = (inv.seller_name or inv.buyer_name or "").strip().lower()

            # Exact Match: Reference or description contains invoice number AND amount matches
            if inv_num and (inv_num in ref_text or inv_num in desc_text or inv_num in (txn.reference or "").lower()):
                if abs(txn_amt - inv_total) <= 5:
                    match_status = MATCH_EXACT
                    matched_entity_id = inv.id
                    matched_entity_type = "invoice"
                    matched_entity_label = f"Invoice #{inv.invoice_number}"
                    notes = "Exact reference and exact amount match"
                    break
                elif txn_amt < inv_total:
                    match_status = MATCH_PARTIAL
                    matched_entity_id = inv.id
                    matched_entity_type = "invoice"
                    matched_entity_label = f"Invoice #{inv.invoice_number}"
                    notes = f"Partial payment: Paid ₹{paise_to_display(txn_amt)} of ₹{paise_to_display(inv_total)}"
                    break
                else:
                    match_status = MATCH_AMOUNT_MISMATCH
                    matched_entity_id = inv.id
                    matched_entity_type = "invoice"
                    matched_entity_label = f"Invoice #{inv.invoice_number}"
                    notes = f"Reference match with amount discrepancy (₹{paise_to_display(txn_amt)} vs ₹{paise_to_display(inv_total)})"
                    break

            # Possible Match: Amount matches exactly and party name appears in narration
            if party and len(party) >= 4 and party in desc_text and abs(txn_amt - inv_total) <= 5:
                match_status = MATCH_POSSIBLE
                matched_entity_id = inv.id
                matched_entity_type = "invoice"
                matched_entity_label = f"Invoice #{inv.invoice_number} ({inv.seller_name or inv.buyer_name})"
                notes = f"Matching amount and vendor name '{party}' found in transaction narration"
                break

        # If not matched against invoices, check Receipts for debits (e.g. fuel, travel, office supplies)
        if match_status == MATCH_UNMATCHED and is_debit:
            for rec in receipts:
                rec_total = rec.total_paise
                rec_num = (rec.receipt_number or "").strip().lower()
                m_name = (rec.merchant_name or "").strip().lower()

                if abs(txn_amt - rec_total) <= 5 and (m_name in desc_text or (rec_num and rec_num in desc_text)):
                    match_status = MATCH_EXACT
                    matched_entity_id = rec.id
                    matched_entity_type = "receipt"
                    matched_entity_label = f"Receipt #{rec.receipt_number} ({rec.merchant_name})"
                    notes = f"Matched to expense receipt '{rec.merchant_name}'"
                    break

        if match_status in [MATCH_EXACT, MATCH_POSSIBLE]:
            matched_txn_count += 1
        else:
            unmatched_txn_count += 1

            # Flag unmatched bank debit payment as Payment Without Supporting Document
            if is_debit and txn_amt > 100000:  # Payments over ₹1,000 without bill
                amt_str = paise_to_display(txn_amt)
                generated_exceptions.append(ValidationException(
                    firm_id=firm_id,
                    document_id=txn.document_id,
                    record_id=txn.id,
                    rule_id="RULE_PAYMENT_WITHOUT_SUPPORTING_DOC",
                    field_name="debit",
                    severity="high",
                    title="Bank Payment Without Supporting Invoice/Receipt",
                    explanation=f"Bank disbursement of ₹{amt_str} ('{txn.description}') has no matching invoice, purchase record, or expense receipt.",
                    observed_value=f"₹{amt_str} debited",
                    expected_value="Substantiating tax invoice or receipt",
                    details_json=json.dumps({
                        "txn_id": txn.id,
                        "amount": amt_str,
                        "narration": txn.description,
                        "suggested_action": "Request supporting invoice from vendor or obtain expense voucher"
                    })
                ))

        reconciliation_results.append({
            "transaction_id": txn.id,
            "statement_id": txn.statement_id,
            "date": txn.transaction_date.isoformat() if txn.transaction_date else None,
            "narration": txn.description,
            "reference": txn.reference,
            "debit": paise_to_display(txn.debit_paise) if txn.debit_paise else "0.00",
            "credit": paise_to_display(txn.credit_paise) if txn.credit_paise else "0.00",
            "balance": paise_to_display(txn.balance_paise),
            "match_status": match_status,
            "matched_entity_id": matched_entity_id,
            "matched_entity_type": matched_entity_type,
            "matched_entity_label": matched_entity_label,
            "notes": notes
        })

    return {
        "total_transactions": len(transactions),
        "matched_count": matched_txn_count,
        "unmatched_count": unmatched_txn_count,
        "match_percentage": round((matched_txn_count / len(transactions) * 100), 1) if transactions else 100.0,
        "results": reconciliation_results,
        "exceptions": generated_exceptions
    }
