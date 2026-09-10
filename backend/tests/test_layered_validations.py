"""
Comprehensive automated tests for the 12 concrete Layered Validation & Reconciliation Scenarios.

Scenarios tested:
1. Missing required field (invoice number, date, party, total)
2. Invalid GSTIN structure
3. Arithmetic mismatch (Tax sum, Subtotal + Tax, Line items)
4. Tax consistency (CGST != SGST, or CGST + IGST co-existence)
5. Duplicate invoice & conflicting totals
6. Invoice missing from sales/purchase register
7. Register entry missing supporting invoice
8. Cross-record amount mismatch between invoice and register
9. Exact bank match
10. Partial bank payment & amount mismatch
11. Bank payment without supporting document
12. CA Workflow Controls: Approval blocked by high severity, field correction, rerun checks, CA approval
"""

import pytest
import uuid
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.document import Document
from app.models.organization import Organization, BusinessAccount
from app.models.validation_exception import ValidationException
from app.models.exception import FinancialException
from app.models.registers import (
    Invoice,
    Receipt,
    SalesRecord,
    PurchaseRecord,
    BankStatement,
    BankTransaction,
)
from app.services.rule_engine import (
    verify_required_fields,
    verify_gstin,
    verify_invoice_arithmetic,
    verify_line_items_arithmetic,
    verify_tax_consistency,
    verify_statement_integrity,
    validate_extracted_data,
)
from app.services.reconciliation_service import (
    compare_invoices_with_registers,
    reconcile_bank_transactions,
    MATCH_EXACT,
    MATCH_PARTIAL,
    MATCH_AMOUNT_MISMATCH,
    MATCH_UNMATCHED,
)
from app.services.normalizer import to_paise


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed test org and business
        org = Organization(id="org_test", name="Demo Firm", slug="demo-firm")
        db.add(org)
        biz = BusinessAccount(id="biz_test", organization_id="org_test", legal_name="Apex Global Traders")
        db.add(biz)
        db.commit()
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# SCENARIO 1: Missing required fields (Layer 1)
# ---------------------------------------------------------------------------
def test_scenario_1_missing_required_fields():
    doc_id = str(uuid.uuid4())
    data = {
        # Missing invoice_number, date, total, vendor
        "subtotal": 1000.0,
        "currency": "XYZ"  # Non-recognized currency
    }
    exceptions = verify_required_fields("invoices", data, doc_id=doc_id, firm_id="default_firm")
    rule_ids = {e.rule_id for e in exceptions}

    assert "RULE_MISSING_INVOICE_NUMBER" in rule_ids
    assert "RULE_MISSING_OR_INVALID_DATE" in rule_ids
    assert "RULE_MISSING_VENDOR_NAME" in rule_ids
    assert "RULE_INVALID_CURRENCY" in rule_ids


# ---------------------------------------------------------------------------
# SCENARIO 2: Invalid GSTIN structure (Layer 1)
# ---------------------------------------------------------------------------
def test_scenario_2_invalid_gstin():
    doc_id = str(uuid.uuid4())
    # Malformed GSTIN
    gstin_exc = verify_gstin("INVALID123GSTIN", doc_id=doc_id, firm_id="default_firm")
    assert gstin_exc is not None
    assert gstin_exc.rule_id == "RULE_INVALID_GSTIN_FORMAT"

    # Invalid state code prefix
    bad_state_exc = verify_gstin("99AAACA1234A1Z5", doc_id=doc_id, firm_id="default_firm")
    # 99 is valid Center jurisdiction, try 00
    bad_prefix_exc = verify_gstin("00AAACA1234A1Z5", doc_id=doc_id, firm_id="default_firm")
    assert bad_prefix_exc is not None
    assert bad_prefix_exc.rule_id == "RULE_GSTIN_STATE_CODE_MISMATCH"


# ---------------------------------------------------------------------------
# SCENARIO 3: Arithmetic mismatches (Tax sum, Subtotal + Tax = Total, Line items)
# ---------------------------------------------------------------------------
def test_scenario_3_arithmetic_mismatches():
    doc_id = str(uuid.uuid4())
    # Subtotal 1000 + Tax 200 = 1200, but Total given as 1500
    # Also CGST(90) + SGST(90) = 180, but tax_total given as 200
    exceptions = verify_invoice_arithmetic(
        subtotal=1000.0,
        cgst=90.0,
        sgst=90.0,
        tax_total=200.0,
        grand_total=1500.0,
        doc_id=doc_id,
        firm_id="default_firm"
    )
    rule_ids = {e.rule_id for e in exceptions}

    assert "RULE_TAX_SUM_MISMATCH" in rule_ids
    assert "RULE_MATH_TOTAL_MISMATCH" in rule_ids

    # Test Line items sum != Subtotal
    data = {
        "subtotal": 1000.0,
        "line_items": [
            {"description": "Item A", "quantity": 2, "unit_price": 400.0, "amount": 800.0},
            {"description": "Item B", "quantity": 1, "unit_price": 100.0, "amount": 100.0}
            # Sum of line items = 900 != Subtotal 1000
        ]
    }
    line_excs = verify_line_items_arithmetic(data, doc_id=doc_id, firm_id="default_firm")
    line_rule_ids = {e.rule_id for e in line_excs}
    assert "RULE_LINE_ITEMS_SUBTOTAL_MISMATCH" in line_rule_ids


# ---------------------------------------------------------------------------
# SCENARIO 4: Wrong tax combination (CGST != SGST, or CGST + IGST combined)
# ---------------------------------------------------------------------------
def test_scenario_4_tax_consistency():
    doc_id = str(uuid.uuid4())
    # 1. CGST != SGST
    data1 = {
        "cgst": 90.0,
        "sgst": 60.0,  # Unequal
        "tax_total": 150.0
    }
    excs1 = verify_tax_consistency(data1, doc_id=doc_id, firm_id="default_firm")
    rule_ids1 = {e.rule_id for e in excs1}
    assert "RULE_CGST_SGST_RATE_MISMATCH" in rule_ids1

    # 2. Both CGST and IGST together
    data2 = {
        "cgst": 90.0,
        "sgst": 90.0,
        "igst": 180.0,  # Mutually exclusive
        "tax_total": 360.0
    }
    excs2 = verify_tax_consistency(data2, doc_id=doc_id, firm_id="default_firm")
    rule_ids2 = {e.rule_id for e in excs2}
    assert "RULE_MUTUALLY_EXCLUSIVE_TAXES" in rule_ids2

    # 3. Tax charged without seller GSTIN
    data3 = {
        "cgst": 90.0,
        "sgst": 90.0,
        "tax_total": 180.0,
        "seller_gstin": None
    }
    excs3 = verify_tax_consistency(data3, doc_id=doc_id, firm_id="default_firm")
    rule_ids3 = {e.rule_id for e in excs3}
    assert "RULE_TAX_WITHOUT_GSTIN" in rule_ids3


# ---------------------------------------------------------------------------
# SCENARIO 5: Duplicate invoice & conflicting totals
# ---------------------------------------------------------------------------
def test_scenario_5_conflicting_totals_for_same_invoice(test_db):
    # Insert existing invoice INV-500 with total 10,000
    existing_inv = Invoice(
        id=str(uuid.uuid4()),
        document_id="doc_old",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="INV-500",
        invoice_date=date(2026, 9, 1),
        seller_name="Apex Traders",
        invoice_total_paise=1000000
    )
    test_db.add(existing_inv)
    test_db.commit()

    # Now validate new invoice with same invoice_number INV-500 but total 12,000
    doc_id = str(uuid.uuid4())
    data = {
        "invoice_number": "INV-500",
        "date": "2026-09-01",
        "vendor": "Apex Traders",
        "total": 12000.0,
        "subtotal": 12000.0
    }
    exceptions = validate_extracted_data(doc_id, "default_firm", "invoices", data, db=test_db)
    rule_ids = {e.rule_id for e in exceptions}
    assert "RULE_SAME_INVOICE_CONFLICTING_TOTALS" in rule_ids


# ---------------------------------------------------------------------------
# SCENARIO 6: Invoice missing from register
# ---------------------------------------------------------------------------
def test_scenario_6_invoice_missing_from_register(test_db):
    # Create an uploaded invoice in the database with no corresponding sales/purchase record
    inv = Invoice(
        id=str(uuid.uuid4()),
        document_id="doc_inv_1",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="INV-9999",
        invoice_date=date(2026, 9, 2),
        seller_name="Apex Traders",
        invoice_total_paise=5000000
    )
    test_db.add(inv)
    test_db.commit()

    excs = compare_invoices_with_registers(test_db, firm_id="default_firm")
    missing_inv_excs = [e for e in excs if e.rule_id == "RULE_INVOICE_MISSING_FROM_REGISTER"]
    assert len(missing_inv_excs) == 1
    assert missing_inv_excs[0].record_id == inv.id


# ---------------------------------------------------------------------------
# SCENARIO 7: Register row missing an invoice
# ---------------------------------------------------------------------------
def test_scenario_7_register_entry_missing_invoice(test_db):
    # Sales record without supporting invoice
    sr = SalesRecord(
        id=str(uuid.uuid4()),
        document_id="doc_sheet_1",
        firm_id="default_firm",
        invoice_number="SR-8888",
        invoice_date=date(2026, 9, 5),
        customer_name="Client Alpha",
        invoice_total_paise=2500000
    )
    test_db.add(sr)
    test_db.commit()

    excs = compare_invoices_with_registers(test_db, firm_id="default_firm")
    missing_doc_excs = [e for e in excs if e.rule_id == "RULE_SUPPORTING_INVOICE_MISSING"]
    assert len(missing_doc_excs) == 1
    assert missing_doc_excs[0].record_id == sr.id


# ---------------------------------------------------------------------------
# SCENARIO 8: Cross-record amount mismatch between invoice & register
# ---------------------------------------------------------------------------
def test_scenario_8_cross_record_amount_mismatch(test_db):
    # Uploaded invoice INV-777 for ₹10,000 (1,000,000 paise)
    inv = Invoice(
        id=str(uuid.uuid4()),
        document_id="doc_inv_777",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="INV-777",
        invoice_date=date(2026, 9, 3),
        seller_name="Apex Traders",
        invoice_total_paise=1000000
    )
    # Register row INV-777 recorded as ₹12,000 (1,200,000 paise)
    sr = SalesRecord(
        id=str(uuid.uuid4()),
        document_id="doc_sheet_777",
        firm_id="default_firm",
        invoice_number="INV-777",
        invoice_date=date(2026, 9, 3),
        customer_name="Buyer Beta",
        invoice_total_paise=1200000
    )
    test_db.add(inv)
    test_db.add(sr)
    test_db.commit()

    excs = compare_invoices_with_registers(test_db, firm_id="default_firm")
    amt_mismatches = [e for e in excs if e.rule_id == "RULE_REGISTER_AMOUNT_MISMATCH"]
    assert len(amt_mismatches) == 1
    assert "10000.00" in amt_mismatches[0].observed_value
    assert "12000.00" in amt_mismatches[0].expected_value


# ---------------------------------------------------------------------------
# SCENARIO 9: Exact bank match
# ---------------------------------------------------------------------------
def test_scenario_9_exact_bank_match(test_db):
    # Invoice for ₹29,500
    inv = Invoice(
        id=str(uuid.uuid4()),
        document_id="doc_inv_pay",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="INV-1024",
        invoice_date=date(2026, 9, 3),
        seller_name="Apex Traders",
        invoice_total_paise=2950000
    )
    # Bank statement with transaction referencing INV-1024 for ₹29,500
    stmt = BankStatement(
        id=str(uuid.uuid4()),
        document_id="doc_stmt_1",
        firm_id="default_firm",
        bank_name="HDFC Bank",
        account_number_masked="XXXX77",
        opening_balance_paise=10000000,
        closing_balance_paise=12950000
    )
    txn = BankTransaction(
        id=str(uuid.uuid4()),
        statement_id=stmt.id,
        document_id="doc_stmt_1",
        transaction_date=date(2026, 9, 4),
        description="NEFT INFLOW INV-1024 APEX",
        reference="INV-1024",
        debit_paise=0,
        credit_paise=2950000,
        balance_paise=12950000
    )
    test_db.add_all([inv, stmt, txn])
    test_db.commit()

    res = reconcile_bank_transactions(test_db, firm_id="default_firm")
    assert res["matched_count"] >= 1
    txn_match = next((r for r in res["results"] if r["transaction_id"] == txn.id), None)
    assert txn_match is not None
    assert txn_match["match_status"] == MATCH_EXACT
    assert txn_match["matched_entity_label"] == "Invoice #INV-1024"


# ---------------------------------------------------------------------------
# SCENARIO 10: Partial bank payment & amount mismatch
# ---------------------------------------------------------------------------
def test_scenario_10_partial_and_mismatched_bank_payment(test_db):
    inv = Invoice(
        id=str(uuid.uuid4()),
        document_id="doc_inv_big",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="INV-2000",
        invoice_date=date(2026, 9, 1),
        seller_name="Apex Traders",
        invoice_total_paise=10000000  # ₹100,000
    )
    stmt = BankStatement(
        id=str(uuid.uuid4()),
        document_id="doc_stmt_2",
        firm_id="default_firm",
        bank_name="HDFC Bank",
        account_number_masked="XXXX77",
        opening_balance_paise=10000000,
        closing_balance_paise=15000000
    )
    # Partial payment of ₹50,000 referencing INV-2000
    partial_txn = BankTransaction(
        id=str(uuid.uuid4()),
        statement_id=stmt.id,
        document_id="doc_stmt_2",
        transaction_date=date(2026, 9, 5),
        description="NEFT PARTIAL INV-2000",
        reference="INV-2000",
        debit_paise=0,
        credit_paise=5000000,  # ₹50,000
        balance_paise=15000000
    )
    test_db.add_all([inv, stmt, partial_txn])
    test_db.commit()

    res = reconcile_bank_transactions(test_db, firm_id="default_firm")
    txn_res = next(r for r in res["results"] if r["transaction_id"] == partial_txn.id)
    assert txn_res["match_status"] == MATCH_PARTIAL
    assert "Partial payment" in txn_res["notes"]


# ---------------------------------------------------------------------------
# SCENARIO 11: Bank payment without supporting document
# ---------------------------------------------------------------------------
def test_scenario_11_payment_without_supporting_doc(test_db):
    stmt = BankStatement(
        id=str(uuid.uuid4()),
        document_id="doc_stmt_3",
        firm_id="default_firm",
        bank_name="Axis Bank",
        account_number_masked="XXXX56",
        opening_balance_paise=50000000,
        closing_balance_paise=45000000
    )
    # High-value debit without matching invoice or voucher
    debit_txn = BankTransaction(
        id=str(uuid.uuid4()),
        statement_id=stmt.id,
        document_id="doc_stmt_3",
        transaction_date=date(2026, 9, 8),
        description="WIRE TRANSFER UNKNOWN SUPPLIER",
        reference="WT-8822",
        debit_paise=5000000,  # ₹50,000
        credit_paise=0,
        balance_paise=45000000
    )
    test_db.add_all([stmt, debit_txn])
    test_db.commit()

    res = reconcile_bank_transactions(test_db, firm_id="default_firm")
    assert len(res["exceptions"]) >= 1
    unsupported_exc = next((e for e in res["exceptions"] if e.rule_id == "RULE_PAYMENT_WITHOUT_SUPPORTING_DOC"), None)
    assert unsupported_exc is not None
    assert unsupported_exc.severity == "high"


# ---------------------------------------------------------------------------
# STATEMENT INTEGRITY: Opening + credits - debits = closing & running continuity
# ---------------------------------------------------------------------------
def test_statement_integrity_checks():
    doc_id = str(uuid.uuid4())
    # Mismatched closing balance
    stmt_data = {
        "opening_balance": 10000.0,
        "closing_balance": 15000.0,  # Expected 10000 + 4000 - 1000 = 13000
        "transactions": [
            {"txn_date": "2026-09-01", "debit": 1000.0, "credit": 0.0, "balance": 9000.0},
            {"txn_date": "2026-09-02", "debit": 0.0, "credit": 4000.0, "balance": 13000.0}
        ]
    }
    excs = verify_statement_integrity(stmt_data, doc_id=doc_id, firm_id="default_firm")
    rule_ids = {e.rule_id for e in excs}
    assert "RULE_STATEMENT_BALANCE_DISCREPANCY" in rule_ids


# ---------------------------------------------------------------------------
# SCENARIO 12: CA Workflow Controls: Approval blocked, field correction, rerun checks, CA approval
# ---------------------------------------------------------------------------
def test_scenario_12_workflow_correction_and_approval_controls(test_db):
    from app.api.v1.intake import approve_document, update_document_field
    from app.schemas.document import DocumentFieldUpdate
    from fastapi import HTTPException

    # 1. Create document with an arithmetic error (subtotal=1000, tax=180, total=1500)
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        organization_id="org_test",
        business_id="biz_test",
        firm_id="default_firm",
        document_type="invoices",
        original_filename="sample_invoice.pdf",
        storage_key="test_key",
        file_hash="hash_invoice_123",
        file_size=2048,
        mime_type="application/pdf",
        status="needs_review",
        review_status="pending_review",
        extracted_data={
            "invoice_number": "INV-789",
            "date": "2026-09-05",
            "vendor": "Apex Supplies",
            "vendor_name": "Apex Supplies",
            "seller_gstin": "27AAACA1234A1Z5",
            "subtotal": 1000.0,
            "cgst": 90.0,
            "sgst": 90.0,
            "tax_total": 180.0,
            "total": 1500.0  # Incorrect!
        },
        revision=1
    )
    test_db.add(doc)

    # Add high-severity validation exception
    exc = ValidationException(
        firm_id="default_firm",
        document_id=doc_id,
        rule_id="RULE_MATH_TOTAL_MISMATCH",
        field_name="total",
        severity="high",
        title="Arithmetic Mismatch",
        explanation="Subtotal + Tax != Total",
        observed_value="1500",
        expected_value="1180",
        status="open"
    )
    test_db.add(exc)
    test_db.commit()

    # 2. Attempt CA approval -> MUST BE BLOCKED due to high severity exception
    with pytest.raises(HTTPException) as exc_info:
        approve_document(document_id=doc_id, reviewer_name="CA Hehram", db=test_db)
    assert exc_info.value.status_code == 400
    assert "unresolved high-severity exception" in exc_info.value.detail

    # 3. Require reason for correction: update without reason fails
    with pytest.raises(HTTPException) as exc_reason_info:
        update_document_field(
            document_id=doc_id,
            payload=DocumentFieldUpdate(field_name="total", updated_value=1180.0, reason=""),
            db=test_db
        )
    assert exc_reason_info.value.status_code == 400
    assert "reason is required" in exc_reason_info.value.detail

    # 4. Correct the total to 1180.0 with valid reason -> checks re-run automatically
    updated_doc = update_document_field(
        document_id=doc_id,
        payload=DocumentFieldUpdate(
            field_name="total",
            updated_value=1180.0,
            reason="Corrected arithmetic discrepancy based on physical tax invoice inspection"
        ),
        db=test_db
    )

    # Verification: revision incremented, review_status is pending_review, checks passed
    assert updated_doc.revision == 2
    assert updated_doc.status == "checks_passed"
    assert updated_doc.review_status == "pending_review"

    # 5. CA Approval now succeeds because high-severity exceptions are cleared
    approved_doc = approve_document(document_id=doc_id, reviewer_name="CA Hehram", db=test_db)
    assert approved_doc.review_status == "approved_by_ca"
    assert approved_doc.reviewed_by == "CA Hehram"
