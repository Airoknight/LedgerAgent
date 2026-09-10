import os
import secrets
from sqlalchemy.orm import Session
from app.core.database import engine, Base
from app.core.config import settings
from app.models.firm import Firm
from app.models.organization import Organization, User, BusinessAccount
from app.models.document import Document
from app.models.exception import FinancialException
from app.models.validation_exception import ValidationException
from app.models.audit import AuditEvent
from app.models.setting import Setting
from app.core.security import get_password_hash

def run_migrations(db_engine):
    """Ensure newly added columns exist in existing SQLite tables (lightweight migrations)."""
    with db_engine.connect() as conn:
        # Check users table
        res = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        cols = [r[1] for r in res]
        if cols:
            if "firm_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN firm_id VARCHAR")
            if "failed_login_attempts" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
            if "locked_until" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN locked_until DATETIME")

        # Check documents table
        res = conn.exec_driver_sql("PRAGMA table_info(documents)").fetchall()
        cols = [r[1] for r in res]
        if cols:
            if "firm_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN firm_id VARCHAR")
            if "ocr_text" not in cols:
                conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN ocr_text TEXT")
            if "revision" not in cols:
                conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN revision INTEGER DEFAULT 1")

        # Check validation_exceptions table
        res = conn.exec_driver_sql("PRAGMA table_info(validation_exceptions)").fetchall()
        cols = [r[1] for r in res]
        if cols:
            if "field_name" not in cols:
                conn.exec_driver_sql("ALTER TABLE validation_exceptions ADD COLUMN field_name VARCHAR")

        # Check audit_events table
        res = conn.exec_driver_sql("PRAGMA table_info(audit_events)").fetchall()
        cols = [r[1] for r in res]
        if cols:
            if "firm_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE audit_events ADD COLUMN firm_id VARCHAR")

        # Check financial_exceptions table
        res = conn.exec_driver_sql("PRAGMA table_info(financial_exceptions)").fetchall()
        cols = [r[1] for r in res]
        if cols:
            if "firm_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE financial_exceptions ADD COLUMN firm_id VARCHAR")

        conn.commit()

def init_db(db: Session):
    # 0. Lightweight migrations for any existing tables
    run_migrations(engine)

    # 1. Create all 11 tables
    Base.metadata.create_all(bind=engine)

    # 2. Seed Default Firm: AiroKnight Studios
    firm = db.query(Firm).filter(Firm.id == settings.DEFAULT_FIRM_ID).first()
    if not firm:
        firm = Firm(
            id=settings.DEFAULT_FIRM_ID,
            name=settings.DEFAULT_FIRM_NAME,
            slug="airoknight-studios",
            legal_name="AiroKnight Studios LLP",
            pan="AAACA1234A",
            gstin="27AAACA1234A1Z5",
            currency="INR",
            financial_year_start="04-01",
            is_active=True
        )
        db.add(firm)
        db.flush()

    # 3. Seed Default Organization & Business for backwards compatibility
    org = db.query(Organization).filter(Organization.slug == "default-org").first()
    if not org:
        org = Organization(
            name=settings.DEFAULT_FIRM_NAME,
            slug="default-org",
            is_active=True
        )
        db.add(org)
        db.flush()

    biz = db.query(BusinessAccount).first()
    if not biz:
        biz = BusinessAccount(
            organization_id=org.id,
            legal_name="AiroKnight Studios LLP",
            trade_name="AiroKnight Accounting Studio",
            gstin="27AAACA1234A1Z5",
            pan="AAACA1234A",
            currency="INR"
        )
        db.add(biz)
        db.flush()

    # 4. Seed Default Settings
    default_settings = [
        ("accounting_period", "September 2026"),
        ("gst_tax_rate", "18"),
        ("currency", "INR"),
        ("allow_ai_tax_advice", "false"),
    ]
    for k, v in default_settings:
        if not db.query(Setting).filter(Setting.key == k, Setting.firm_id == firm.id).first():
            db.add(Setting(
                id=f"setting_{k}",
                firm_id=firm.id,
                key=k,
                value_json=f'"{v}"',
                updated_by="System Initialization"
            ))

    # 5. First-User Initialization (safe environment or CLI setup)
    admin_user = db.query(User).filter(User.firm_id == firm.id).first()
    if not admin_user:
        admin_email = os.environ.get("ADMIN_EMAIL", settings.ADMIN_EMAIL or "ca.hehram@ledgeragent.io").strip().lower()
        admin_pass = os.environ.get("ADMIN_PASSWORD")
        if not admin_pass:
            # Generate a secure one-time password if not configured in environment
            admin_pass = os.environ.get("FIRST_USER_PASSWORD", "AiroKnight2026!Secure")
            print(f"\n[SECURITY NOTICE] Initialized first CA user: '{admin_email}'.")
            print(f"[SECURITY NOTICE] Password configured from environment/seed. Change via CLI or .env in production.\n")

        admin_user = User(
            firm_id=firm.id,
            organization_id=org.id,
            email=admin_email,
            full_name="CA Hehram (Chartered Accountant)",
            hashed_password=get_password_hash(admin_pass),
            role="ca_admin",
            is_active=True
        )
        db.add(admin_user)
        db.flush()

    # 6. Demonstration Documents (Disabled by default so user starts with a clean slate)
    if getattr(settings, "SEED_DEMO_DOCUMENTS", False) and db.query(Document).count() == 0:
        doc1 = Document(
            firm_id=firm.id,
            organization_id=org.id,
            business_id=biz.id,
            storage_key="sample_inv_1041.pdf",
            original_filename="INV-1041-Office-Supplies.pdf",
            file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_size=245120,
            mime_type="application/pdf",
            page_count=1,
            document_type="purchase_invoice",
            status="checks_passed",
            review_status="approved_by_ca",
            reviewed_by="CA Hehram",
            confidence_score=0.98,
            extracted_data={
                "vendor_name": "Apex Stationery Mart",
                "vendor_gstin": "27AAACA1234A1Z5",
                "buyer_name": "AiroKnight Studios LLP",
                "buyer_gstin": "27AAACA1234A1Z5",
                "invoice_number": "INV-1041",
                "invoice_date": "2026-09-02",
                "subtotal": 12500.00,
                "cgst": 1125.00,
                "sgst": 1125.00,
                "igst": 0.00,
                "total": 14750.00,
                "line_items": [
                    {"description": "A4 Paper Reams (Box of 10)", "qty": 5, "unit": "Box", "rate": 1500.00, "amount": 7500.00, "tax_rate": 18},
                    {"description": "Laser Printer Cartridges", "qty": 2, "unit": "Nos", "rate": 2500.00, "amount": 5000.00, "tax_rate": 18}
                ]
            },
            validation_results=[
                {"rule": "Line Items Sum", "status": "pass", "message": "7500 + 5000 = 12500"},
                {"rule": "GST Tax Calculation", "status": "pass", "message": "18% of 12500 = 2250 (CGST 1125, SGST 1125)"},
                {"rule": "Invoice Total Check", "status": "pass", "message": "12500 + 2250 = 14750.00"}
            ]
        )
        db.add(doc1)
        db.flush()

        doc2 = Document(
            firm_id=firm.id,
            organization_id=org.id,
            business_id=biz.id,
            storage_key="sample_inv_1042_flagged.pdf",
            original_filename="INV-1042-Cloud-Services.pdf",
            file_hash="11a1b1c1d1e1f1a1b1c1d1e1f1a1b1c1d1e1f1a1b1c1d1e1f1a1b1c1d1e1f1a1",
            file_size=184300,
            mime_type="application/pdf",
            page_count=1,
            document_type="purchase_invoice",
            status="needs_review",
            review_status="pending_review",
            confidence_score=0.92,
            extracted_data={
                "vendor_name": "CloudNine Networks Ltd",
                "vendor_gstin": "29BBBCB5678B1Z2",
                "buyer_name": "AiroKnight Studios LLP",
                "buyer_gstin": "27AAACA1234A1Z5",
                "invoice_number": "INV-1042",
                "invoice_date": "2026-09-05",
                "subtotal": 52000.00,
                "cgst": 4680.00,
                "sgst": 4680.00,
                "igst": 0.00,
                "total": 62360.00,  # 52000 + 9360 = 61360, variance = 1000
                "line_items": [
                    {"description": "Dedicated Server Hosting (Sept)", "qty": 1, "unit": "Month", "rate": 52000.00, "amount": 52000.00, "tax_rate": 18}
                ]
            },
            validation_results=[
                {"rule": "Line Items Sum", "status": "pass", "message": "52000 matches subtotal"},
                {"rule": "Tax Amount Check", "status": "pass", "message": "18% of 52000 = 9360 (CGST 4680, SGST 4680)"},
                {"rule": "Invoice Total Check", "status": "fail", "message": "Extracted total ₹62,360 differs from calculated ₹61,360 by ₹1,000"}
            ]
        )
        db.add(doc2)
        db.flush()

        exc2 = FinancialException(
            business_id=biz.id,
            document_id=doc2.id,
            exception_type="arithmetic_mismatch",
            severity="high",
            title="Invoice Total Discrepancy",
            explanation="Invoice total on document reads ₹62,360, but Subtotal (₹52,000) + 18% GST (₹9,360) = ₹61,360. Discrepancy: ₹1,000.",
            suggested_action="Verify if supplier applied unlisted ₹1,000 setup fee or request revised invoice.",
            status="open",
            details={
                "extracted_total": 62360.00,
                "calculated_total": 61360.00,
                "variance": 1000.00,
                "vendor": "CloudNine Networks Ltd"
            }
        )
        db.add(exc2)

        # ValidationException table record
        val_exc = ValidationException(
            firm_id=firm.id,
            document_id=doc2.id,
            rule_id="RULE_TOTAL_SUM",
            field_name="grand_total",
            severity="high",
            title="Invoice Total Discrepancy",
            explanation="Invoice total on document reads ₹62,360, but calculated total equals ₹61,360.",
            observed_value="62360.00",
            expected_value="61360.00",
            status="open"
        )
        db.add(val_exc)

        doc3 = Document(
            firm_id=firm.id,
            organization_id=org.id,
            business_id=biz.id,
            storage_key="sample_bank_sept2026.csv",
            original_filename="HDFC_Current_Account_Sept2026.csv",
            file_hash="99f9e9d9c9b9a999f9e9d9c9b9a999f9e9d9c9b9a999f9e9d9c9b9a999f9e9d9",
            file_size=42100,
            mime_type="text/csv",
            page_count=1,
            document_type="bank_statement",
            status="checks_passed",
            review_status="pending_review",
            confidence_score=1.0,
            extracted_data={
                "bank_name": "HDFC Bank Ltd",
                "account_number": "50200098765432",
                "statement_period": "01-Sep-2026 to 10-Sep-2026",
                "opening_balance": 450000.00,
                "closing_balance": 496750.00,
                "transactions": [
                    {"txn_date": "2026-09-02", "narration": "NEFT-APEX STATIONERY-INV1041", "ref_no": "N260902001", "debit": 14750.00, "credit": 0.00, "balance": 435250.00, "match_status": "matched", "linked_doc": "INV-1041"},
                    {"txn_date": "2026-09-04", "narration": "UPI/9876543210/CLIENT ADVANCE", "ref_no": "UPI26090401", "debit": 0.00, "credit": 75000.00, "balance": 510250.00, "match_status": "unmatched", "linked_doc": None},
                    {"txn_date": "2026-09-06", "narration": "RTGS-CLOUDNINE NETWORKS-INV1042", "ref_no": "R260906003", "debit": 61360.00, "credit": 0.00, "balance": 448890.00, "match_status": "partial_match", "linked_doc": "INV-1042"},
                    {"txn_date": "2026-09-08", "narration": "BANK CHARGES/SMS ALERT", "ref_no": "CHG26090801", "debit": 140.00, "credit": 0.00, "balance": 448750.00, "match_status": "auto_categorized", "linked_doc": "Bank Fee Voucher"},
                    {"txn_date": "2026-09-10", "narration": "IMPS/CLIENT RETENTION/ZENITH", "ref_no": "I260910009", "debit": 0.00, "credit": 48000.00, "balance": 496750.00, "match_status": "matched", "linked_doc": "INV-SALES-902"}
                ]
            }
        )
        db.add(doc3)

    # 7. Audit Event for initialization
    audit = AuditEvent(
        firm_id=firm.id,
        organization_id=org.id,
        actor_name="System Initialization",
        action="workspace.init",
        entity_type="firm",
        entity_id=firm.id,
        details_json=f'{{"firm_name": "{firm.name}", "status": "ready"}}'
    )
    db.add(audit)
    db.commit()
