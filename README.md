# LedgerAgent (Phase 1 MVP)

**AI-Powered Accounting Operations & Workflow Automation Studio for Chartered Accountants**

LedgerAgent unifies financial document ingestion, deterministic validation, and human-in-the-loop exception handling within a clean local-first workspace for Chartered Accountants.

Firm Workspace: **AiroKnight Studios** (`default_firm`)

---

## Architecture & Security Foundation (Phase 1)

1. **Local-First SQLite Database (11 Tables)**:
   - `firms`: Multi-tenant boundary (`default_firm` / `AiroKnight Studios`)
   - `users`: Authenticated CA and staff accounts
   - `sessions`: Cryptographic server-side sessions with CSRF binding & expiration
   - `documents`: Ingested financial files (invoices, receipts, bank statements)
   - `extracted_records`: Minor-unit financial extractions (subtotal, tax, grand total)
   - `validation_exceptions`: Deterministic arithmetic, duplicate, and tax discrepancy records
   - `approvals`: Explicit human Chartered Accountant sign-offs
   - `reports`: Generated period-end summaries and reconciliation reports
   - `chat_messages`: Context-aware conversational history
   - `audit_events`: Append-only immutable compliance audit trail
   - `settings`: Firm-specific accounting policies, fiscal period, and tax rates

2. **Local Authentication & Security**:
   - **PBKDF2-SHA256 Password Hashing**: Zero plaintext storage.
   - **Server-Side Sessions**: Session ID issued in `HttpOnly`, `SameSite=Lax` cookie (`ledgeragent_session`).
   - **CSRF Protection**: All state-changing mutations (`POST`, `PUT`, `DELETE`, `PATCH`) require matching `X-CSRF-Token` header.
   - **Login Throttling**: 5 consecutive failed login attempts trigger a 15-minute account lockout (HTTP 429).
   - **Localhost Boundary Guard**: Backend binds strictly to `127.0.0.1:8000` with host and origin validation.
   - **Security Headers**: All responses enforce `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Setup & Running Instructions

### Prerequisites
- Python 3.11+ with Astral `uv` installed (`pip install uv` or via installer)
- Node.js 18+ and `npm`

---

### 1. Backend Setup & Run

Navigate to the `backend/` directory:
```powershell
cd backend
```

#### Step A: Initialize Database & Seed Defaults
```powershell
uv run python -m app.cli init-db
```
This automatically initializes the SQLite database schema (`ledgeragent.db`) and seeds the default firm **AiroKnight Studios** (`default_firm`) along with default fiscal settings.

#### Step B: Create / Configure CA User Account
You can provision the primary Chartered Accountant user via the CLI:
```powershell
uv run python -m app.cli create-user --email ca.hehram@ledgeragent.io --password "AiroKnight2026!Secure" --name "CA Hehram" --role ca_admin
```

To view all provisioned users:
```powershell
uv run python -m app.cli list-users
```

#### Step C: Start the Backend Server (Bound to `127.0.0.1`)
```powershell
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- OpenAPI Documentation: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/v1/health/ready`

---

### 2. Frontend Setup & Run

Open a new terminal and navigate to the `frontend/` directory:
```powershell
cd frontend
npm install
npm run dev
```
- Open `http://localhost:3000` in your web browser.
- Log in with your provisioned CA credentials (e.g. `ca.hehram@ledgeragent.io` / `AiroKnight2026!Secure`).

---

### 3. Running Automated Tests

Run the full automated pytest suite (covers auth, CSRF rejection, session expiry, login throttling, password hashing, and API routes):
```powershell
cd backend
uv run pytest tests/ -v
```

All 18 tests will run and pass:
```text
tests/test_api.py::test_health_live PASSED
tests/test_api.py::test_health_ready PASSED
tests/test_api.py::test_list_seeded_documents PASSED
tests/test_api.py::test_list_exceptions PASSED
tests/test_api.py::test_chat_slash_summary PASSED
tests/test_api.py::test_chat_context_aware_query PASSED
tests/test_api.py::test_upload_and_duplicate_detection PASSED
tests/test_api.py::test_delete_document PASSED
tests/test_auth_and_foundation.py::test_password_hashing PASSED
tests/test_auth_and_foundation.py::test_default_firm_and_user_seeding PASSED
tests/test_auth_and_foundation.py::test_cli_user_creation PASSED
tests/test_auth_and_foundation.py::test_successful_login_and_cookie_issuance PASSED
tests/test_auth_and_foundation.py::test_login_throttling_and_lockout PASSED
tests/test_auth_and_foundation.py::test_protected_routes_unauthenticated_rejection PASSED
tests/test_auth_and_foundation.py::test_csrf_protection_on_mutations PASSED
tests/test_auth_and_foundation.py::test_session_logout_and_revocation PASSED
tests/test_auth_and_foundation.py::test_session_expiry_handling PASSED
tests/test_auth_and_foundation.py::test_security_response_headers PASSED
```

---

## Environment Variables Reference

Create a `.env` file in `backend/` to override defaults if desired:
```ini
APP_ENV=development
HOST=127.0.0.1
PORT=8000
DATABASE_URL=sqlite:///./ledgeragent.db
DEFAULT_FIRM_ID=default_firm
DEFAULT_FIRM_NAME=AiroKnight Studios
SESSION_COOKIE_NAME=ledgeragent_session
SESSION_EXPIRE_HOURS=24
ADMIN_EMAIL=ca.hehram@ledgeragent.io
ADMIN_PASSWORD=AiroKnight2026!Secure
```
