import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.firm import Firm
from app.models.document import Document
from app.models.registers import (
    Invoice, InvoiceLineItem,
    Receipt,
    SalesRecord, PurchaseRecord,
    BankStatement, BankTransaction,
    OtherDocument,
)
from app.services.normalizer import (
    to_paise, from_paise, paise_to_display,
    normalize_date, normalize_and_persist,
)
from app.services.rule_engine import (
    verify_gstin,
    verify_required_fields,
    verify_invoice_arithmetic,
    validate_extracted_data,
    detect_cross_file_duplicates,
)


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    firm = Firm(id="test_firm", name="Test Firm", legal_name="Test Firm LLP")
    session.add(firm)
    session.commit()

    yield session

    session.close()


def test_paise_conversion_helpers():
    # Number inputs
    assert to_paise(11800.50) == 1180050
    assert to_paise(50000) == 5000000
    assert to_paise(0.0) == 0
    assert to_paise(None) == 0
    assert to_paise("") == 0

    # Formatted currency string inputs
    assert to_paise("11800.50") == 1180050
    assert to_paise("Rs. 11,800/-") == 1180000
    assert to_paise("₹50,000.00") == 5000000
    assert to_paise("₹ 1,23,456.75") == 12345675
    assert to_paise("$150.25") == 15025

    # Reverse helpers
    assert from_paise(1180050) == Decimal("11800.50")
    assert from_paise(5000000) == Decimal("50000.00")
    assert paise_to_display(1180050) == "11800.50"
    assert paise_to_display(5000000) == "50000.00"


def test_date_normalization():
    assert normalize_date("2026-09-10") == date(2026, 9, 10)
    assert normalize_date("10/09/2026") == date(2026, 9, 10)
    assert normalize_date("10-09-2026") == date(2026, 9, 10)
    assert normalize_date("September 10, 2026") == date(2026, 9, 10)
    assert normalize_date("Sep 10, 2026") == date(2026, 9, 10)
    assert normalize_date(None) is None
    assert normalize_date("unknown") is None


def test_invoice_normalization_and_persistence(test_db):
    doc = Document(
        id="doc_inv_1",
        firm_id="test_firm",
        storage_key="test_key_1",
        original_filename="tax_invoice_101.pdf",
        file_hash="dummy_hash_1",
        file_size=1024,
        mime_type="application/pdf",
        document_type="invoices",
        ocr_text="Tax Invoice No: INV-2026-001\nTotal: Rs. 11,800/-",
        revision=1
    )
    test_db.add(doc)
    test_db.commit()

    raw_data = {
        "invoice_number": "INV-2026-001",
        "invoice_date": "2026-09-10",
        "due_date": "2026-09-25",
        "seller_name": "Acme Industrial Supplies",
        "seller_gstin": "27AAACA1234A1Z5",
        "buyer_name": "AiroKnight Studios",
        "buyer_gstin": "27AABCU9603R1ZM",
        "subtotal": "10000.00",
        "cgst": "900.00",
        "sgst": "900.00",
        "grand_total": "11800.00",
        "currency": "INR",
        "line_items": [
            {
                "description": "Server Hosting Unit",
                "hsn_sac": "998313",
                "quantity": 2,
                "unit_price": "5000.00",
                "tax_rate": 18.0,
                "amount": "10000.00"
            }
        ]
    }

    reg_id = normalize_and_persist(
        db=test_db,
        document_id=doc.id,
        firm_id="test_firm",
        category="invoices",
        extracted_data=raw_data,
        raw_ocr_text=doc.ocr_text
    )
    test_db.commit()

    assert reg_id is not None

    inv = test_db.query(Invoice).filter(Invoice.id == reg_id).first()
    assert inv is not None
    assert inv.invoice_number == "INV-2026-001"
    assert inv.invoice_date == date(2026, 9, 10)
    assert inv.seller_name == "Acme Industrial Supplies"
    assert inv.subtotal_paise == 1000000
    assert inv.cgst_paise == 90000
    assert inv.sgst_paise == 90000
    assert inv.invoice_total_paise == 1180000
    assert inv.raw_values["invoice_number"] == "INV-2026-001"
    assert inv.raw_values["subtotal"] == "10000.00"

    # Verify line items
    assert len(inv.line_items) == 1
    li = inv.line_items[0]
    assert li.description == "Server Hosting Unit"
    assert li.hsn_sac == "998313"
    assert li.unit_price_paise == 500000
    assert li.tax_rate_bps == 1800
    assert li.amount_paise == 1000000

    # Verify relationship from Document
    refreshed_doc = test_db.query(Document).filter(Document.id == doc.id).first()
    assert refreshed_doc.invoice_record.id == inv.id
    assert refreshed_doc.ocr_text == "Tax Invoice No: INV-2026-001\nTotal: Rs. 11,800/-"
    assert refreshed_doc.revision == 1


def test_receipt_normalization_and_persistence(test_db):
    doc = Document(
        id="doc_rec_1",
        firm_id="test_firm",
        storage_key="test_key_2",
        original_filename="fuel_receipt.png",
        file_hash="dummy_hash_2",
        file_size=512,
        mime_type="image/png",
        document_type="receipts"
    )
    test_db.add(doc)
    test_db.commit()

    raw_data = {
        "receipt_number": "RCP-8842",
        "date": "2026-09-08",
        "merchant_name": "Indian Oil Fuel Station",
        "payment_method": "upi",
        "expense_category": "fuel",
        "subtotal": "2500.00",
        "tax": "450.00",
        "grand_total": "2950.00"
    }

    reg_id = normalize_and_persist(
        db=test_db,
        document_id=doc.id,
        firm_id="test_firm",
        category="receipts",
        extracted_data=raw_data
    )
    test_db.commit()

    rec = test_db.query(Receipt).filter(Receipt.id == reg_id).first()
    assert rec is not None
    assert rec.receipt_number == "RCP-8842"
    assert rec.merchant_name == "Indian Oil Fuel Station"
    assert rec.payment_method == "upi"
    assert rec.total_paise == 295000
    assert rec.subtotal_paise == 250000
    assert rec.tax_paise == 45000


def test_sales_and_purchase_registers(test_db):
    doc_sales = Document(
        id="doc_sales_1",
        firm_id="test_firm",
        storage_key="test_sales_key",
        original_filename="sales_entry.xlsx",
        file_hash="dummy_hash_sales",
        file_size=2048,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        document_type="sales_records"
    )
    test_db.add(doc_sales)

    doc_purch = Document(
        id="doc_purch_1",
        firm_id="test_firm",
        storage_key="test_purch_key",
        original_filename="purch_entry.xlsx",
        file_hash="dummy_hash_purch",
        file_size=2048,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        document_type="purchase_records"
    )
    test_db.add(doc_purch)
    test_db.commit()

    sales_id = normalize_and_persist(
        db=test_db,
        document_id=doc_sales.id,
        firm_id="test_firm",
        category="sales_records",
        extracted_data={
            "invoice_number": "SLS-2026-09",
            "customer_name": "Vertex Software Corp",
            "taxable_amount": "80000.00",
            "grand_total": "94400.00"
        }
    )

    purch_id = normalize_and_persist(
        db=test_db,
        document_id=doc_purch.id,
        firm_id="test_firm",
        category="purchase_records",
        extracted_data={
            "invoice_number": "PUR-5501",
            "vendor_name": "Cloud Infrastructure Ltd",
            "taxable_amount": "40000.00",
            "grand_total": "47200.00"
        }
    )
    test_db.commit()

    sr = test_db.query(SalesRecord).filter(SalesRecord.id == sales_id).first()
    assert sr is not None
    assert sr.customer_name == "Vertex Software Corp"
    assert sr.taxable_amount_paise == 8000000
    assert sr.invoice_total_paise == 9440000

    pr = test_db.query(PurchaseRecord).filter(PurchaseRecord.id == purch_id).first()
    assert pr is not None
    assert pr.vendor_name == "Cloud Infrastructure Ltd"
    assert pr.taxable_amount_paise == 4000000
    assert pr.invoice_total_paise == 4720000


def test_bank_statement_and_transactions(test_db):
    doc = Document(
        id="doc_bank_1",
        firm_id="test_firm",
        storage_key="test_bank_key",
        original_filename="hdfc_statement.pdf",
        file_hash="dummy_hash_bank",
        file_size=4096,
        mime_type="application/pdf",
        document_type="bank_statements"
    )
    test_db.add(doc)
    test_db.commit()

    raw_data = {
        "bank_name": "HDFC Bank Ltd",
        "account_number": "50100412345678",
        "statement_start": "2026-08-01",
        "statement_end": "2026-08-31",
        "opening_balance": "150000.00",
        "closing_balance": "195000.00",
        "transactions": [
            {
                "date": "2026-08-05",
                "narration": "UPI-TRANSFER TO VENDOR",
                "ref_no": "TXN9901",
                "debit": "5000.00",
                "credit": "0.00",
                "balance": "145000.00"
            },
            {
                "date": "2026-08-15",
                "narration": "CLIENT PAYMENT NEFT",
                "ref_no": "TXN9902",
                "debit": "0.00",
                "credit": "50000.00",
                "balance": "195000.00"
            }
        ]
    }

    stmt_id = normalize_and_persist(
        db=test_db,
        document_id=doc.id,
        firm_id="test_firm",
        category="bank_statements",
        extracted_data=raw_data
    )
    test_db.commit()

    stmt = test_db.query(BankStatement).filter(BankStatement.id == stmt_id).first()
    assert stmt is not None
    assert stmt.bank_name == "HDFC Bank Ltd"
    # Masked account number check: "XXXX5678"
    assert stmt.account_number_masked == "XXXX5678"
    assert stmt.opening_balance_paise == 15000000
    assert stmt.closing_balance_paise == 19500000

    assert len(stmt.transactions) == 2
    t1 = stmt.transactions[0]
    assert t1.debit_paise == 500000
    assert t1.credit_paise == 0
    assert t1.balance_paise == 14500000

    t2 = stmt.transactions[1]
    assert t2.debit_paise == 0
    assert t2.credit_paise == 5000000
    assert t2.balance_paise == 19500000


def test_validation_exceptions_field_name_emission():
    # 1. GSTIN rule
    exc = verify_gstin("INVALID_GSTIN", doc_id="d1")
    assert exc is not None
    assert exc.field_name == "gstin"
    assert exc.rule_id == "RULE_INVALID_GSTIN_FORMAT"

    # 2. Required fields
    excs = verify_required_fields("purchase_invoice", {}, doc_id="d2")
    field_names = [e.field_name for e in excs]
    assert "invoice_number" in field_names
    assert "invoice_date" in field_names
    assert "vendor_name" in field_names

    # 3. Arithmetic mismatch
    math_excs = verify_invoice_arithmetic(
        subtotal=10000.0,
        cgst=900.0,
        sgst=900.0,
        tax_total=1800.0,
        grand_total=15000.0,  # mismatch
        doc_id="d3"
    )
    assert len(math_excs) > 0
    math_exc = next(e for e in math_excs if e.rule_id == "RULE_MATH_TOTAL_MISMATCH")
    assert math_exc.field_name == "grand_total"
