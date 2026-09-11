from fastapi import APIRouter, Depends
from app.api.deps import get_current_session, verify_csrf
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.intake import router as intake_router, file_router
from app.api.v1.exceptions import router as exceptions_router
from app.api.v1.reports import router as reports_router
from app.api.v1.chat import router as chat_router
from app.api.v1.reconciliation import router as reconciliation_router
from app.api.v1.accounting import router as accounting_router
from app.api.v1.audit import router as audit_router

api_router = APIRouter()

# Public Routers (Health checks, Authentication, and Document File Previews)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(file_router)

# Protected Routers (Requires active session cookie + CSRF validation on mutations)
api_router.include_router(
    intake_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
api_router.include_router(
    exceptions_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
api_router.include_router(
    reports_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
api_router.include_router(chat_router)
api_router.include_router(
    reconciliation_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
api_router.include_router(
    accounting_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
api_router.include_router(
    audit_router,
    dependencies=[Depends(get_current_session), Depends(verify_csrf)]
)
