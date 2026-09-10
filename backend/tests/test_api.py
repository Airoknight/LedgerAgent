import io
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.services.seed_service import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    db = SessionLocal()
    init_db(db)
    db.close()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_client():
    with TestClient(app) as c:
        import os
        from app.core.config import settings
        admin_email = os.environ.get("ADMIN_EMAIL", "ca.hehram@ledgeragent.io").strip().lower()
        admin_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("FIRST_USER_PASSWORD", "AiroKnight2026!Secure")
        res = c.post("/api/v1/auth/login", json={"email": admin_email, "password": admin_pass})
        csrf_token = res.json().get("csrf_token", "")
        c.headers.update({"X-CSRF-Token": csrf_token})
        yield c

def test_health_live(client):
    res = client.get("/api/v1/health/live")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app_name"] == "LedgerAgent"

def test_health_ready(client):
    res = client.get("/api/v1/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["components"]["database"] == "healthy"
    assert data["components"]["storage"] == "healthy"

def test_list_documents(auth_client):
    res = auth_client.get("/api/v1/documents")
    assert res.status_code == 200
    docs = res.json()
    assert isinstance(docs, list)
    if docs:
        first_id = docs[0]["id"]
        file_res = auth_client.get(f"/api/v1/documents/{first_id}/file")
        assert file_res.status_code == 200


def test_list_exceptions(auth_client):
    res = auth_client.get("/api/v1/exceptions")
    assert res.status_code == 200
    exceptions = res.json()
    assert len(exceptions) >= 1
    assert exceptions[0]["severity"] in ["critical", "high", "medium", "low"]

def test_chat_slash_summary(auth_client):
    res = auth_client.post("/api/v1/chat/query", json={"query": "/summary"})
    assert res.status_code == 200
    data = res.json()
    assert "September 2026 Processing Summary" in data["answer"]

def test_chat_context_aware_query(auth_client):
    docs = auth_client.get("/api/v1/documents").json()
    flagged = next(d for d in docs if d["status"] == "needs_review")
    
    res = auth_client.post("/api/v1/chat/query", json={
        "query": "Why is this invoice flagged?",
        "active_context": {"doc_id": flagged["id"]}
    })
    assert res.status_code == 200
    data = res.json()
    assert "flagged for review" in data["answer"].lower()
    assert "discrepancy" in data["answer"].lower() or "mismatch" in data["answer"].lower()

def test_upload_and_duplicate_detection(auth_client):
    unique_marker = uuid.uuid4().hex.encode("utf-8")
    file_content = b"Mock invoice content for testing duplicate: " + unique_marker
    file_tuple = ("test_invoice.pdf", io.BytesIO(file_content), "application/pdf")
    
    # First upload
    res1 = auth_client.post(
        "/api/v1/intake/upload",
        files=[("files", file_tuple)],
        data={"intake_message": "Test batch"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["accepted_files"] == 1
    assert data1["duplicate_files"] == 0

    # Second upload with identical bytes
    file_tuple_dup = ("test_invoice_copy.pdf", io.BytesIO(file_content), "application/pdf")
    res2 = auth_client.post(
        "/api/v1/intake/upload",
        files=[("files", file_tuple_dup)],
        data={"intake_message": "Test batch duplicate"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["duplicate_files"] == 1

def test_delete_document(auth_client):
    unique_marker = uuid.uuid4().hex.encode("utf-8")
    file_content = b"Mock invoice content to delete: " + unique_marker
    file_tuple = ("file_to_delete.pdf", io.BytesIO(file_content), "application/pdf")

    # Upload file
    res = auth_client.post(
        "/api/v1/intake/upload",
        files=[("files", file_tuple)],
        data={"intake_message": "Upload for deletion test"}
    )
    assert res.status_code == 200
    doc_id = res.json()["documents"][0]["id"]

    # Delete file
    del_res = auth_client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm it's gone
    get_res = auth_client.get(f"/api/v1/documents/{doc_id}")
    assert get_res.status_code == 404


