"""
Automated Pytest Suite for Double-Entry Accounting Engine, Ledgers, Trial Balance, and Financial Statements.

Tests:
1. Chart of Accounts initialization and account metadata
2. Sales Invoice draft journal generation (Double-entry debits = credits = ₹1,18,000)
3. Purchase Invoice draft journal generation (Hosting ₹10,000, CGST/SGST ₹1,800, Payable ₹11,800)
4. Bank receipt and payment double-entry journals
5. Journal approval & posting workflow
6. General Ledger running balance calculation
7. Customer AR and Vendor AP settlement & ageing calculation
8. Trial balance mathematical equilibrium (Debits == Credits)
9. Draft Profit & Loss statement (Revenue, Expenses, Net Profit)
10. Balance Sheet equilibrium & GST Position summary
"""

import pytest
import uuid
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.organization import Organization, BusinessAccount
from app.models.firm import Firm
from app.models.document import Document
from app.models.registers import (
    Invoice,
    SalesRecord,
    PurchaseRecord,
    BankStatement,
    BankTransaction,
)
from app.models.accounting import Account, JournalEntry, JournalLine
from app.services.accounting_service import (
    ensure_chart_of_accounts,
    generate_draft_journal_entries,
    approve_journal_entry,
    post_journal_entry,
    post_all_approved_entries,
    get_general_ledger,
    get_ar_ap_tracking,
    generate_trial_balance,
    generate_financial_statements,
)


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        org = Organization(id="org_test", name="Demo Firm", slug="demo-firm")
        db.add(org)
        biz = BusinessAccount(id="biz_test", organization_id="org_test", legal_name="Apex Global Traders")
        db.add(biz)
        firm = Firm(id="default_firm", name="Demo Firm", legal_name="Demo Firm LLP")
        db.add(firm)
        db.commit()
        yield db
    finally:
        db.close()


def test_chart_of_accounts_initialization(test_db):
    accounts = ensure_chart_of_accounts(test_db, firm_id="default_firm")
    assert len(accounts) >= 15

    acc_map = {a.code: a for a in accounts}
    assert "1000" in acc_map  # Bank
    assert acc_map["1000"].normal_balance == "debit"
    assert "1100" in acc_map  # Trade Receivables
    assert "1300" in acc_map  # Input CGST
    assert "2000" in acc_map  # Trade Payables
    assert acc_map["2000"].normal_balance == "credit"
    assert "4000" in acc_map  # Sales Revenue
    assert "5100" in acc_map  # Cloud Hosting


def test_hackathon_demo_flow_end_to_end(test_db):
    """
    Executes the complete hackathon demo sequence:
    1. Upload & approve Nova Retail sales invoice (₹1,18,000)
    2. Upload & approve Orbit Cloud purchase invoice (₹11,800)
    3. Upload bank statement showing receipt of ₹1,18,000 and payment of ₹11,800
    4. Generate draft journals
    5. Verify double-entry balancing on all drafts
    6. Post journals to General Ledger
    7. Verify Customer Receivables and Vendor Payables settle to ₹0
    8. Verify Trial Balance equilibrium (Debits == Credits)
    9. Verify P&L and Balance Sheet
    """
    # -----------------------------------------------------------------------
    # Step 1: Create Documents and Invoices
    # -----------------------------------------------------------------------
    # Sales Invoice: Nova Retail (SI-201)
    # Taxable ₹1,00,000 + IGST ₹18,000 = ₹1,18,000
    doc_sales = Document(
        id="doc_sales_201",
        organization_id="org_test",
        business_id="biz_test",
        firm_id="default_firm",
        document_type="invoices",
        original_filename="SI-201_Nova_Retail.pdf",
        storage_key="key_sales_201",
        file_hash="hash_si_201",
        file_size=2048,
        mime_type="application/pdf",
        status="checks_passed",
        review_status="approved_by_ca",
        extracted_data={"invoice_number": "SI-201", "total": 118000.0}
    )
    inv_sales = Invoice(
        id="inv_sales_201",
        document_id="doc_sales_201",
        firm_id="default_firm",
        invoice_subtype="sales_invoice",
        invoice_number="SI-201",
        invoice_date=date(2026, 9, 1),
        seller_name="Apex Global Traders",
        buyer_name="Nova Retail",
        subtotal_paise=10000000,        # ₹100,000
        cgst_paise=0,
        sgst_paise=0,
        igst_paise=1800000,             # ₹18,000
        total_tax_paise=1800000,
        invoice_total_paise=11800000    # ₹118,000
    )

    # Purchase Invoice: Orbit Cloud (PI-101)
    # Taxable ₹10,000 + CGST ₹900 + SGST ₹900 = ₹11,800
    doc_purch = Document(
        id="doc_purch_101",
        organization_id="org_test",
        business_id="biz_test",
        firm_id="default_firm",
        document_type="invoices",
        original_filename="PI-101_Orbit_Cloud.pdf",
        storage_key="key_purch_101",
        file_hash="hash_pi_101",
        file_size=2048,
        mime_type="application/pdf",
        status="checks_passed",
        review_status="approved_by_ca",
        extracted_data={"invoice_number": "PI-101", "total": 11800.0}
    )
    inv_purch = Invoice(
        id="inv_purch_101",
        document_id="doc_purch_101",
        firm_id="default_firm",
        invoice_subtype="purchase_invoice",
        invoice_number="PI-101",
        invoice_date=date(2026, 9, 2),
        seller_name="Orbit Cloud Solutions",
        buyer_name="Apex Global Traders",
        subtotal_paise=1000000,         # ₹10,000
        cgst_paise=90000,               # ₹900
        sgst_paise=90000,               # ₹900
        igst_paise=0,
        total_tax_paise=180000,
        invoice_total_paise=1180000     # ₹11,800
    )

    # Bank Statement with Customer Inflow and Vendor Outflow
    stmt = BankStatement(
        id="stmt_sep_2026",
        document_id="doc_stmt_2026",
        firm_id="default_firm",
        bank_name="HDFC Bank",
        account_number_masked="XXXX99",
        opening_balance_paise=5000000,  # ₹50,000
        closing_balance_paise=15620000  # 50,000 + 1,18,000 - 11,800 = 1,56,200
    )
    # Receipt from Nova Retail
    txn_receipt = BankTransaction(
        id="txn_receipt_nova",
        statement_id="stmt_sep_2026",
        document_id="doc_stmt_2026",
        transaction_date=date(2026, 9, 10),
        description="NEFT INFLOW FROM NOVA RETAIL SI-201",
        reference="SI-201",
        debit_paise=0,
        credit_paise=11800000,
        balance_paise=16800000
    )
    # Payment to Orbit Cloud
    txn_payment = BankTransaction(
        id="txn_payment_orbit",
        statement_id="stmt_sep_2026",
        document_id="doc_stmt_2026",
        transaction_date=date(2026, 9, 12),
        description="RTGS PAYMENT TO ORBIT CLOUD PI-101",
        reference="PI-101",
        debit_paise=1180000,
        credit_paise=0,
        balance_paise=15620000
    )

    test_db.add_all([doc_sales, inv_sales, doc_purch, inv_purch, stmt, txn_receipt, txn_payment])
    test_db.commit()

    # -----------------------------------------------------------------------
    # Step 2: Generate Draft Journal Entries
    # -----------------------------------------------------------------------
    res = generate_draft_journal_entries(test_db, firm_id="default_firm")
    assert res["new_drafts_created"] == 4  # Sales, Purchase, Bank Receipt, Bank Payment

    entries = test_db.query(JournalEntry).filter(JournalEntry.firm_id == "default_firm").all()
    assert len(entries) == 4

    # Verify Sales Journal Entry
    sales_je = next(e for e in entries if e.source_type == "sales_invoice")
    assert sales_je.is_balanced is True
    assert sales_je.total_debit_paise == 11800000
    assert sales_je.total_credit_paise == 11800000
    sales_lines = {l.account_code: l for l in sales_je.lines}
    assert sales_lines["1100"].debit_paise == 11800000   # Trade Receivables
    assert sales_lines["1100"].subledger_name == "Nova Retail"
    assert sales_lines["4000"].credit_paise == 10000000  # Revenue
    assert sales_lines["2120"].credit_paise == 1800000   # Output IGST

    # Verify Purchase Journal Entry
    purch_je = next(e for e in entries if e.source_type == "purchase_invoice")
    assert purch_je.is_balanced is True
    assert purch_je.total_debit_paise == 1180000
    assert purch_je.total_credit_paise == 1180000
    purch_lines = {l.account_code: l for l in purch_je.lines}
    assert purch_lines["5100"].debit_paise == 1000000   # Cloud Hosting Expense
    assert purch_lines["1300"].debit_paise == 90000     # Input CGST
    assert purch_lines["1310"].debit_paise == 90000     # Input SGST
    assert purch_lines["2000"].credit_paise == 1180000  # Trade Payables (Orbit Cloud)

    # -----------------------------------------------------------------------
    # Step 3: Batch Post to General Ledger
    # -----------------------------------------------------------------------
    posted_count = post_all_approved_entries(test_db, firm_id="default_firm")
    assert posted_count == 4

    # Verify General Ledger
    gl = get_general_ledger(test_db, firm_id="default_firm")
    gl_accounts = {a["account_code"]: a for a in gl["accounts"]}

    # Bank Ledger: Received 1,18,000 − Paid 11,800 = Net inflow 1,06,200
    assert "1000" in gl_accounts
    assert gl_accounts["1000"]["closing_balance"] == 10620000

    # Trade Receivables: Debited 1,18,000 (Invoice) − Credited 1,18,000 (Receipt) = ₹0 Balance!
    assert "1100" in gl_accounts
    assert gl_accounts["1100"]["closing_balance"] == 0

    # Trade Payables: Credited 11,800 (Invoice) − Debited 11,800 (Payment) = ₹0 Balance!
    assert "2000" in gl_accounts
    assert gl_accounts["2000"]["closing_balance"] == 0

    # Revenue: ₹1,00,000
    assert gl_accounts["4000"]["closing_balance"] == 10000000

    # Cloud Hosting Expense: ₹10,000
    assert gl_accounts["5100"]["closing_balance"] == 1000000

    # -----------------------------------------------------------------------
    # Step 4: Accounts Receivable & Accounts Payable Tracking
    # -----------------------------------------------------------------------
    ar_ap = get_ar_ap_tracking(test_db, firm_id="default_firm")
    nova_item = next(i for i in ar_ap["accounts_receivable"]["items"] if i["customer"] == "Nova Retail")
    assert nova_item["status"] == "Paid"
    assert nova_item["outstanding_amount"] == "0.00"

    orbit_item = next(i for i in ar_ap["accounts_payable"]["items"] if "Orbit" in i["vendor"])
    assert orbit_item["status"] == "Paid"
    assert orbit_item["outstanding_amount"] == "0.00"

    # -----------------------------------------------------------------------
    # Step 5: Trial Balance Equilibrium Verification
    # -----------------------------------------------------------------------
    tb = generate_trial_balance(test_db, firm_id="default_firm")
    assert tb["is_balanced"] is True
    assert tb["total_debit"] == tb["total_credit"]

    # -----------------------------------------------------------------------
    # Step 6: Financial Statements (P&L, Balance Sheet, GST Position)
    # -----------------------------------------------------------------------
    fin = generate_financial_statements(test_db, firm_id="default_firm")

    # Profit & Loss
    pnl = fin["profit_and_loss"]
    assert pnl["total_revenue"] == "100000.00"
    assert pnl["total_expenses"] == "10000.00"
    assert pnl["net_profit"] == "90000.00"
    assert pnl["is_profitable"] is True

    # Balance Sheet
    bs = fin["balance_sheet"]
    assert bs["is_balanced"] is True
    # Assets (Bank 1,06,200 + Input GST 1,800 = 1,08,000)
    # Liabilities (Output GST 18,000) + Equity (Profit 90,000) = 1,08,000!
    assert bs["total_assets"] == bs["total_liabilities_and_equity"]

    # GST Summary
    gst = fin["gst_summary"]
    assert gst["input_tax_credit"]["total_itc"] == "1800.00"
    assert gst["output_tax_liability"]["total_output"] == "18000.00"
    assert gst["net_gst_position"]["net_payable"] == "16200.00"


def test_remap_journal_line_and_status_progression(test_db):
    """
    Verifies that an entry with an uncategorized line starts as Needs Mapping,
    cannot be approved in that state, transitions to Ready for Review upon remapping,
    and can then be CA approved and posted.
    """
    ensure_chart_of_accounts(test_db, firm_id="default_firm")

    entry = JournalEntry(
        id="je_remap_test",
        firm_id="default_firm",
        entry_number="JE-2026-REMAP",
        posting_date=date(2026, 9, 5),
        source_type="purchase_invoice",
        source_id="pi_unknown",
        narration="Unknown Vendor Bill",
        status="needs_mapping",
        total_debit_paise=500000,
        total_credit_paise=500000,
        is_balanced=True,
        revision=1,
        lines=[
            JournalLine(
                line_number=1,
                account_code="5900",
                account_name="Uncategorized Expense",
                debit_paise=500000,
                credit_paise=0
            ),
            JournalLine(
                line_number=2,
                account_code="2000",
                account_name="Trade Payables",
                debit_paise=0,
                credit_paise=500000
            )
        ]
    )
    test_db.add(entry)
    test_db.commit()

    # 1. Attempting to approve must fail
    with pytest.raises(ValueError, match="Uncategorized Expense"):
        approve_journal_entry(test_db, "je_remap_test")

    # 2. Remap line 1 to 5100 Cloud Hosting
    from app.services.accounting_service import remap_journal_line
    updated = remap_journal_line(test_db, "je_remap_test", line_number=1, account_code="5100")
    assert updated.status == "ready_for_review"
    assert updated.revision == 2
    assert updated.lines[0].account_code == "5100"
    assert updated.lines[0].account_name == "Cloud Hosting & IT Infrastructure"

    # 3. Now CA approval succeeds
    approved = approve_journal_entry(test_db, "je_remap_test", reviewer_name="CA Hehram")
    assert approved.status == "ca_approved"
    assert approved.reviewer == "CA Hehram"

    # 4. Final posting succeeds
    posted = post_journal_entry(test_db, "je_remap_test")
    assert posted.status == "posted"
