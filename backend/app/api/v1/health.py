import os
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.core.storage import storage
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("/live", response_model=HealthResponse)
def health_live():
    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        components={"api": "healthy"}
    )

@router.get("/ready", response_model=HealthResponse)
def health_ready(db: Session = Depends(get_db)):
    components = {}
    is_ready = True

    # 1. Check Database
    try:
        db.execute(text("SELECT 1"))
        components["database"] = "healthy"
    except Exception as e:
        components["database"] = f"unhealthy: {str(e)}"
        is_ready = False

    # 2. Check Storage
    try:
        test_key = "__health_check_test.tmp"
        storage.save_bytes(b"health_check", test_key, "derivatives")
        if storage.exists(test_key, "derivatives"):
            components["storage"] = "healthy"
            # cleanup
            os.remove(storage.get_path(test_key, "derivatives"))
        else:
            components["storage"] = "unhealthy: verification failed"
            is_ready = False
    except Exception as e:
        components["storage"] = f"unhealthy: {str(e)}"
        is_ready = False

    overall_status = "ok" if is_ready else "degraded"
    return HealthResponse(
        status=overall_status,
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        components=components
    )

