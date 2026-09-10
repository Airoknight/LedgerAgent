"""
Normalizer service: converts raw LLM/OCR extraction dicts into typed register rows.

Key design rules:
- All monetary values stored as integer paise (₹11,800.50 → 1180050)
- Raw OCR strings preserved in raw_values_json alongside normalized columns
- Dates parsed to Python date objects
- Unknown/unparseable values stored as NULL, not fake defaults
"""
import re
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional, Dict

from sqlalchemy.orm import Session

from app.models.registers import (
    Invoice, InvoiceLineItem,
    Receipt,
    SalesRecord, PurchaseRecord,
    BankStatement, BankTransaction,
    OtherDocument,
)


# ---------------------------------------------------------------------------
# Paise Conversion Helpers
# ---------------------------------------------------------------------------

def to_paise(value: Any) -> int:
    """
    Convert any monetary representation to integer paise.

    Handles:
        11800.50        → 1180050
        "11800.50"      → 1180050
        "Rs. 11,800/-"  → 1180000
        "₹50,000.00"   → 5000000
        None / ""       → 0
    """
    if value is None:
        return 0

    if isinstance(value, (int, float)):
        return int(round(value * 100))

    s = str(value).strip()
    if not s:
        return 0

    # Remove trailing /- or /– or /=
    s = re.sub(r"/[-–—=]+$", "", s)
    # Remove currency words/symbols and whitespace
    s = re.sub(r"(?i)\b(rs\.?|inr|usd|eur|gbp)\b", "", s)
    s = re.sub(r"[₹$€£¥\s]", "", s)
    # Remove thousand-separator commas
    s = s.replace(",", "")

    # Find valid numeric string (e.g., -123.45 or 123.45)
    match = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    if not match:
        return 0

    try:
        return int(round(Decimal(match.group(0)) * 100))
    except (InvalidOperation, ValueError):
        return 0


def from_paise(paise: int) -> Decimal:
    """Convert integer paise to Decimal rupees: 1180050 → Decimal('11800.50')"""
    return Decimal(paise) / Decimal(100)


def paise_to_display(paise: int) -> str:
    """Convert paise to display string: 1180050 → '11800.50'"""
    d = from_paise(paise)
    return f"{d:.2f}"


# ---------------------------------------------------------------------------
# Date Normalization
# ---------------------------------------------------------------------------

_DATE_FORMATS = [
    "%Y-%m-%d",       # 2026-09-10
    "%d/%m/%Y",       # 10/09/2026
    "%d-%m-%Y",       # 10-09-2026
    "%d.%m.%Y",       # 10.09.2026
    "%m/%d/%Y",       # 09/10/2026
    "%d/%m/%y",       # 10/09/26
    "%d-%m-%y",       # 10-09-26
    "%Y/%m/%d",       # 2026/09/10
    "%B %d, %Y",      # September 10, 2026
    "%b %d, %Y",      # Sep 10, 2026
    "%d %B %Y",       # 10 September 2026
    "%d %b %Y",       # 10 Sep 2026
]


def normalize_date(raw: Any) -> Optional[date]:
    """Parse various date string formats into a Python date object."""
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw
    if isinstance(raw, datetime):
        return raw.date()

    s = str(raw).strip()
    if not s or s.lower() in ("none", "null", "n/a", "unknown", ""):
        return None

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    return None


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------

def _get_str(data: dict, *keys: str) -> Optional[str]:
    """Get first non-empty string value from multiple possible keys."""
    for k in keys:
        val = data.get(k)
        if val is not None:
            s = str(val).strip()
            if s and s.lower() not in ("none", "null", "n/a", "unknown"):
                return s
    return None


def _get_raw_values(data: dict, field_names: list) -> dict:
    """Collect original raw string values for specified fields."""
    raw = {}
    for field in field_names:
        val = data.get(field)
        if val is not None:
            raw[field] = str(val)
    return raw


# ---------------------------------------------------------------------------
# Main normalization entry point
# ---------------------------------------------------------------------------

def normalize_and_persist(
    db: Session,
    document_id: str,
    firm_id: str,
    category: str,
    extracted_data: dict,
    raw_ocr_text: str = ""
) -> Optional[str]:
    """
    Create the appropriate category-specific register row(s) from extracted data.

    Returns the register record ID, or None if category is unrecognized.
    """
    cat = category.lower().strip()

    if cat == "invoices":
        return _persist_invoice(db, document_id, firm_id, extracted_data)
    elif cat == "receipts":
        return _persist_receipt(db, document_id, firm_id, extracted_data)
    elif cat == "sales_records":
        return _persist_sales_record(db, document_id, firm_id, extracted_data)
    elif cat == "purchase_records":
        return _persist_purchase_record(db, document_id, firm_id, extracted_data)
    elif cat == "bank_statements":
        return _persist_bank_statement(db, document_id, firm_id, extracted_data)
    elif cat == "others":
        return _persist_other_document(db, document_id, firm_id, extracted_data)
    else:
        return _persist_other_document(db, document_id, firm_id, extracted_data)


# ---------------------------------------------------------------------------
# Category-specific persisters
# ---------------------------------------------------------------------------

def _persist_invoice(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    raw_fields = [
        "invoice_number", "invoice_date", "due_date", "seller_name", "vendor_name",
        "seller_gstin", "vendor_gstin", "buyer_name", "buyer_gstin", "place_of_supply",
        "subtotal", "cgst", "sgst", "igst", "tax_total", "tax", "round_off",
        "grand_total", "total", "invoice_total", "currency"
    ]

    inv = Invoice(
        document_id=document_id,
        firm_id=firm_id,
        invoice_subtype=_get_str(data, "invoice_subtype") or "tax_invoice",
        invoice_number=_get_str(data, "invoice_number", "identifier", "bill_no"),
        invoice_date=normalize_date(data.get("invoice_date") or data.get("date")),
        due_date=normalize_date(data.get("due_date")),
        seller_name=_get_str(data, "seller_name", "vendor_name", "party_name"),
        seller_gstin=_get_str(data, "seller_gstin", "vendor_gstin", "party_tax_id"),
        buyer_name=_get_str(data, "buyer_name"),
        buyer_gstin=_get_str(data, "buyer_gstin"),
        place_of_supply=_get_str(data, "place_of_supply"),
        currency=_get_str(data, "currency") or "INR",
        subtotal_paise=to_paise(data.get("subtotal")),
        cgst_paise=to_paise(data.get("cgst")),
        sgst_paise=to_paise(data.get("sgst")),
        igst_paise=to_paise(data.get("igst")),
        total_tax_paise=to_paise(data.get("tax_total") or data.get("tax")),
        round_off_paise=to_paise(data.get("round_off")),
        invoice_total_paise=to_paise(data.get("grand_total") or data.get("total") or data.get("invoice_total")),
        raw_values=_get_raw_values(data, raw_fields),
    )
    db.add(inv)
    db.flush()

    # Line items
    line_items = data.get("line_items") or []
    for idx, item in enumerate(line_items):
        if not isinstance(item, dict):
            continue
        li = InvoiceLineItem(
            invoice_id=inv.id,
            line_number=idx + 1,
            description=str(item.get("description") or ""),
            hsn_sac=_get_str(item, "hsn_sac", "hsn", "sac"),
            quantity_thousandths=int(round(float(item.get("quantity") or item.get("qty") or 1) * 1000)),
            unit_price_paise=to_paise(item.get("unit_price") or item.get("rate")),
            tax_rate_bps=int(round(float(item.get("tax_rate") or 0) * 100)),
            amount_paise=to_paise(item.get("amount")),
        )
        db.add(li)

    return inv.id


def _persist_receipt(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    raw_fields = [
        "receipt_number", "date", "merchant_name", "vendor_name", "merchant_gstin",
        "payment_method", "payment_mode", "expense_category", "category_name",
        "description", "subtotal", "tax", "tax_total", "grand_total", "total", "currency"
    ]

    rec = Receipt(
        document_id=document_id,
        firm_id=firm_id,
        receipt_number=_get_str(data, "receipt_number", "identifier", "invoice_number"),
        date=normalize_date(data.get("date") or data.get("invoice_date")),
        merchant_name=_get_str(data, "merchant_name", "vendor_name", "party_name"),
        merchant_gstin=_get_str(data, "merchant_gstin", "vendor_gstin"),
        payment_method=_get_str(data, "payment_method", "payment_mode"),
        expense_category=_get_str(data, "expense_category", "category_name"),
        description=_get_str(data, "description"),
        currency=_get_str(data, "currency") or "INR",
        subtotal_paise=to_paise(data.get("subtotal")),
        tax_paise=to_paise(data.get("tax") or data.get("tax_total")),
        total_paise=to_paise(data.get("grand_total") or data.get("total")),
        raw_values=_get_raw_values(data, raw_fields),
    )
    db.add(rec)
    db.flush()
    return rec.id


def _persist_sales_record(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    raw_fields = [
        "invoice_number", "invoice_date", "customer_name", "customer_gstin",
        "party_name", "vendor_name", "party_tax_id", "vendor_gstin",
        "subtotal", "taxable_amount", "cgst", "sgst", "igst", "tax_total", "tax",
        "grand_total", "total", "currency"
    ]

    rec = SalesRecord(
        document_id=document_id,
        firm_id=firm_id,
        source_row_number=data.get("source_row_number"),
        invoice_number=_get_str(data, "invoice_number", "identifier"),
        invoice_date=normalize_date(data.get("invoice_date") or data.get("date")),
        customer_name=_get_str(data, "customer_name", "party_name", "vendor_name"),
        customer_gstin=_get_str(data, "customer_gstin", "party_tax_id", "vendor_gstin"),
        currency=_get_str(data, "currency") or "INR",
        taxable_amount_paise=to_paise(data.get("taxable_amount") or data.get("subtotal")),
        cgst_paise=to_paise(data.get("cgst")),
        sgst_paise=to_paise(data.get("sgst")),
        igst_paise=to_paise(data.get("igst")),
        total_tax_paise=to_paise(data.get("tax_total") or data.get("tax")),
        invoice_total_paise=to_paise(data.get("grand_total") or data.get("total")),
        raw_values=_get_raw_values(data, raw_fields),
    )
    db.add(rec)
    db.flush()
    return rec.id


def _persist_purchase_record(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    raw_fields = [
        "invoice_number", "invoice_date", "vendor_name", "vendor_gstin",
        "party_name", "party_tax_id", "subtotal", "taxable_amount",
        "cgst", "sgst", "igst", "tax_total", "tax", "grand_total", "total", "currency"
    ]

    rec = PurchaseRecord(
        document_id=document_id,
        firm_id=firm_id,
        source_row_number=data.get("source_row_number"),
        invoice_number=_get_str(data, "invoice_number", "identifier"),
        invoice_date=normalize_date(data.get("invoice_date") or data.get("date")),
        vendor_name=_get_str(data, "vendor_name", "party_name", "seller_name"),
        vendor_gstin=_get_str(data, "vendor_gstin", "party_tax_id", "seller_gstin"),
        currency=_get_str(data, "currency") or "INR",
        taxable_amount_paise=to_paise(data.get("taxable_amount") or data.get("subtotal")),
        cgst_paise=to_paise(data.get("cgst")),
        sgst_paise=to_paise(data.get("sgst")),
        igst_paise=to_paise(data.get("igst")),
        total_tax_paise=to_paise(data.get("tax_total") or data.get("tax")),
        invoice_total_paise=to_paise(data.get("grand_total") or data.get("total")),
        raw_values=_get_raw_values(data, raw_fields),
    )
    db.add(rec)
    db.flush()
    return rec.id


def _persist_bank_statement(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    raw_fields = [
        "bank_name", "account_number", "statement_period",
        "opening_balance", "closing_balance", "currency"
    ]

    # Mask account number for storage
    acct = _get_str(data, "account_number") or ""
    if len(acct) > 4:
        acct_masked = "XXXX" + acct[-4:]
    else:
        acct_masked = acct

    stmt = BankStatement(
        document_id=document_id,
        firm_id=firm_id,
        bank_name=_get_str(data, "bank_name", "party_name"),
        account_number_masked=acct_masked,
        statement_start=normalize_date(data.get("statement_start") or data.get("date")),
        statement_end=normalize_date(data.get("statement_end")),
        currency=_get_str(data, "currency") or "INR",
        opening_balance_paise=to_paise(data.get("opening_balance")),
        closing_balance_paise=to_paise(data.get("closing_balance")),
        raw_values=_get_raw_values(data, raw_fields),
    )
    db.add(stmt)
    db.flush()

    # Transaction rows
    txns = data.get("transactions") or []
    for idx, txn in enumerate(txns):
        if not isinstance(txn, dict):
            continue
        bt = BankTransaction(
            statement_id=stmt.id,
            document_id=document_id,
            source_row_number=idx + 1,
            transaction_date=normalize_date(txn.get("date") or txn.get("txn_date")),
            value_date=normalize_date(txn.get("value_date")),
            description=str(txn.get("narration") or txn.get("description") or ""),
            reference=_get_str(txn, "ref_no", "reference", "cheque_no"),
            currency=_get_str(data, "currency") or "INR",
            debit_paise=to_paise(txn.get("debit") or txn.get("withdrawal")),
            credit_paise=to_paise(txn.get("credit") or txn.get("deposit")),
            balance_paise=to_paise(txn.get("balance")),
        )
        db.add(bt)

    return stmt.id


def _persist_other_document(db: Session, document_id: str, firm_id: str, data: dict) -> str:
    detected = data.get("detected_fields") or {}
    if not detected:
        # Collect all non-meta fields as detected_fields
        skip_keys = {"category", "document_type", "title", "summary", "confidence", "boxes", "raw_text", "duplicate_info"}
        detected = {k: v for k, v in data.items() if k not in skip_keys and v is not None}

    other = OtherDocument(
        document_id=document_id,
        firm_id=firm_id,
        title=_get_str(data, "title") or "Unclassified Document",
        summary=_get_str(data, "summary"),
        detected_fields=detected,
    )
    db.add(other)
    db.flush()
    return other.id
