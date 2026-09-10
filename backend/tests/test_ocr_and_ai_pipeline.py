import io
import uuid
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.document import Document
from app.models.extracted_record import ExtractedRecord
from app.models.validation_exception import ValidationException
from app.services.ocr_service import run_rapid_ocr, classify_and_extract_with_ollama
from app.services.rule_engine import validate_extracted_data
from app.services.seed_service import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    db = SessionLocal()
    init_db(db)
    db.close()

@pytest.fixture
def auth_client():
    with TestClient(app) as c:
        res = c.post(
            "/api/v1/auth/login",
            json={"email": "ca.hehram@ledgeragent.io", "password": "AiroKnight2026!Secure"}
        )
        token = res.json().get("csrf_token", "")
        c.headers.update({"X-CSRF-Token": token})
        yield c

def _create_mock_invoice_image():
    """Generates a clean synthetic invoice image with text for RapidOCR verification."""
    img = Image.new("RGB", (600, 300), color="white")
    d = ImageDraw.Draw(img)
    d.text((20, 20), "ABC Traders", fill="black")
    d.text((20, 50), "Bill No: 1042", fill="black")
    d.text((20, 80), "Date: 10/09/2026", fill="black")
    d.text((20, 110), "GSTIN: 27AAACA1234A1Z5", fill="black")
    d.text((20, 140), "Taxable: 50000", fill="black")
    d.text((20, 170), "GST: 9000", fill="black")
    d.text((20, 200), "Grand Total: 59000", fill="black")
    
    buf = BytesIO = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_rapid_ocr_execution():
    """Verify local RapidOCR engine executes and extracts text/boxes from an image."""
    img_bytes = _create_mock_invoice_image()
    raw_text, boxes = run_rapid_ocr(img_bytes)
    assert raw_text != ""
    assert "ABC" in raw_text or "1042" in raw_text or "50000" in raw_text or "59000" in raw_text
    assert len(boxes) > 0
    assert "bbox" in boxes[0]

def test_rule_engine_clean_invoice():
    """Verify deterministic rule engine marks consistent invoices with 0 exceptions."""
    data = {
        "invoice_number": "INV-1042",
        "vendor_name": "ABC Traders",
        "vendor_gstin": "27AAACA1234A1Z5",
        "invoice_date": "2026-09-10",
        "subtotal": 50000.0,
        "tax_total": 9000.0,
        "grand_total": 59000.0
    }
    exceptions = validate_extracted_data("doc-1", "default_firm", "purchase_invoice", data)
    assert len(exceptions) == 0

def test_rule_engine_arithmetic_discrepancy():
    """Verify deterministic rule engine detects arithmetic variance (₹50k + ₹9k != ₹62,360)."""
    data = {
        "invoice_number": "INV-1042",
        "vendor_name": "Cloud Infra Tech",
        "vendor_gstin": "27AAACA1234A1Z5",
        "invoice_date": "2026-09-10",
        "subtotal": 50000.0,
        "tax_total": 9000.0,
        "grand_total": 62360.0  # Mismatch by ₹3,360
    }
    exceptions = validate_extracted_data("doc-2", "default_firm", "purchase_invoice", data)
    assert len(exceptions) >= 1
    math_exc = next((e for e in exceptions if e.rule_id == "RULE_MATH_TOTAL_MISMATCH"), None)
    assert math_exc is not None
    assert math_exc.severity == "high"
    assert "₹62,360.00" in math_exc.observed_value
    assert "₹59,000.00" in math_exc.expected_value

def test_rule_engine_invalid_gstin():
    """Verify GSTIN checksum and length validation."""
    data = {
        "invoice_number": "INV-1042",
        "vendor_name": "Vendor Corp",
        "vendor_gstin": "INVALID-GSTIN-123", # Invalid format
        "invoice_date": "2026-09-10",
        "subtotal": 1000.0,
        "tax_total": 180.0,
        "grand_total": 1180.0
    }
    exceptions = validate_extracted_data("doc-3", "default_firm", "purchase_invoice", data)
    gst_exc = next((e for e in exceptions if e.rule_id == "RULE_INVALID_GSTIN_FORMAT"), None)
    assert gst_exc is not None
    assert gst_exc.severity == "medium"

def test_rule_engine_missing_invoice_number():
    """Verify missing required invoice identifier is flagged."""
    data = {
        "invoice_number": None,
        "vendor_name": "ABC Traders",
        "invoice_date": "2026-09-10",
        "subtotal": 50000.0,
        "tax_total": 9000.0,
        "grand_total": 59000.0
    }
    exceptions = validate_extracted_data("doc-4", "default_firm", "purchase_invoice", data)
    inv_exc = next((e for e in exceptions if e.rule_id == "RULE_MISSING_INVOICE_NUMBER"), None)
    assert inv_exc is not None

def test_classification_and_extraction():
    """Verify document classification into 5+1 categories (invoices, receipts, sales_records, purchase_records, bank_statements, others) and uniform JSON format."""
    text = (
        "ABC Traders\n"
        "Bill No: 1042\n"
        "Date: 10/09/2026\n"
        "GSTIN: 27AAACA1234A1Z5\n"
        "Taxable: 50000\n"
        "GST: 9000\n"
        "Grand Total: 59000\n"
    )
    doc_type, extracted, conf = classify_and_extract_with_ollama(text, "invoice_test.pdf")
    assert doc_type in ["invoices", "purchase_invoice"]
    assert "invoice_number" in extracted or "identifier" in extracted
    assert "subtotal" in extracted
    assert "grand_total" in extracted or "total" in extracted
    assert float(extracted.get("grand_total") or extracted.get("total") or 0) > 0

def test_end_to_end_upload_creates_records_and_exceptions(auth_client):
    """Verify file upload runs pipeline, saves ExtractedRecord, and flags exceptions."""
    # 1. Clean upload (checks_passed) with unique marker
    unique_id = uuid.uuid4().hex[:8]
    clean_content = (
        f"ABC Traders\nBill No: INV-{unique_id}\nDate: 10/09/2026\nGSTIN: 27AAACA1234A1Z5\nTaxable: 50000\nGST: 9000\nGrand Total: 59000\n".encode("utf-8")
    )
    res_clean = auth_client.post(
        "/api/v1/intake/upload",
        files=[("files", (f"valid_invoice_{unique_id}.pdf", io.BytesIO(clean_content), "application/pdf"))]
    )
    assert res_clean.status_code == 200
    clean_json = res_clean.json()
    assert clean_json["accepted_files"] == 1
    doc_id = clean_json["documents"][0]["id"]

    db = SessionLocal()
    doc_db = db.query(Document).filter(Document.id == doc_id).first()
    assert doc_db is not None
    assert doc_db.status in ["checks_passed", "processed"]

    # Verify ExtractedRecord persisted
    ext_rec = db.query(ExtractedRecord).filter(ExtractedRecord.document_id == doc_id).first()
    assert ext_rec is not None
    assert ext_rec.record_type in ["invoices", "purchase_invoice", "sales_invoice"]
    assert "subtotal" in ext_rec.data

    # 2. Upload with intentional mismatch (needs_review) with unique marker
    err_id = uuid.uuid4().hex[:8]
    mismatch_content = f"Mock invoice with mismatch {err_id}".encode("utf-8")
    res_err = auth_client.post(
        "/api/v1/intake/upload",
        files=[("files", (f"mismatch_bill_{err_id}.pdf", io.BytesIO(mismatch_content), "application/pdf"))]
    )
    assert res_err.status_code == 200
    err_json = res_err.json()
    assert err_json["accepted_files"] == 1
    err_doc_id = err_json["documents"][0]["id"]

    err_doc = db.query(Document).filter(Document.id == err_doc_id).first()
    assert err_doc.status == "needs_review"

    # Verify ValidationException persisted
    exceptions = db.query(ValidationException).filter(ValidationException.document_id == err_doc_id).all()
    assert len(exceptions) >= 1
    db.close()
