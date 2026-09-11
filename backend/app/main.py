import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.seed_service import init_db
from app.api.v1.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables, default firm, and records on startup
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="LedgerAgent: AI-Powered Accounting Operations & Workflow Automation Studio for Chartered Accountants",
    lifespan=lifespan
)

# CORS configuration with explicit credentials support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token", "X-Request-ID", "Set-Cookie"],
)

from app.core.rate_limiter import rate_limit_middleware

app.middleware("http")(rate_limit_middleware)

# Security Response Headers & Origin Validation Middleware
@app.middleware("http")
async def security_headers_and_origin_guard(request: Request, call_next):
    # Host header check
    host = request.headers.get("Host", "").split(":")[0]
    if host and host not in ["127.0.0.1", "localhost", "testserver"]:
        return JSONResponse(
            status_code=400,
            content={"detail": f"Untrusted host: {host}. LedgerAgent is bound to local 127.0.0.1."}
        )

    # Origin header check for state-changing requests
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        origin = request.headers.get("Origin")
        if origin:
            clean_origin = origin.rstrip("/")
            allowed = [o.rstrip("/") for o in settings.CORS_ORIGINS]
            if clean_origin not in allowed and not clean_origin.startswith("http://localhost:") and not clean_origin.startswith("http://127.0.0.1:"):
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Forbidden cross-origin request from: {origin}"}
                )

    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    
    # Secure Response Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.endswith("/file"):
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000;"
    else:
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    return response

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "firm": settings.DEFAULT_FIRM_NAME,
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }
