# LedgerAgent Backend (Phase 1)

FastAPI local-first backend for LedgerAgent, bound to `127.0.0.1:8000`.

## Quick Start

1. **Initialize Database & Seed Firm**:
   ```powershell
   uv run python -m app.cli init-db
   ```

2. **Create / Update User**:
   ```powershell
   uv run python -m app.cli create-user --email ca.hehram@ledgeragent.io --password "AiroKnight2026!Secure" --name "CA Hehram"
   ```

3. **Start Backend**:
   ```powershell
   uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Run Tests**:
   ```powershell
   uv run pytest tests/ -v
   ```

