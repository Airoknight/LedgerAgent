import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.config import settings

class SlidingWindowRateLimiter:
    """
    Sliding-window rate limiter with per-IP and per-endpoint tracking.
    In multi-instance deployments, backing storage can be swapped with Redis.
    """
    def __init__(self):
        # Map: key -> list of timestamps
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds

        # Prune old timestamps
        reqs = [t for t in self.requests[key] if t > window_start]
        self.requests[key] = reqs

        if len(reqs) >= max_requests:
            oldest = reqs[0]
            retry_after = max(1, int(window_seconds - (now - oldest)))
            return True, retry_after

        self.requests[key].append(now)
        return False, 0

    def get_remaining(self, key: str, max_requests: int, window_seconds: int = 60) -> int:
        now = time.time()
        window_start = now - window_seconds
        reqs = [t for t in self.requests[key] if t > window_start]
        return max(0, max_requests - len(reqs))

limiter = SlidingWindowRateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    # Only enforce if rate limiting is enabled
    if not getattr(settings, "RATE_LIMIT_ENABLED", True):
        return await call_next(request)

    client_ip = request.client.host if request.client else "127.0.0.1"
    path = request.url.path

    # In unit tests with Starlette TestClient, scale limit so multi-test runs don't self-throttle
    is_test = client_ip in ["testclient"] or getattr(settings, "ENVIRONMENT", "") == "testing"

    # Specific tighter limits for sensitive routes
    if "/auth/login" in path or "/auth/password-reset" in path:
        limit = 5000 if is_test else 15
        window = 60
        key = f"auth:{client_ip}"
    elif "/intake/upload" in path:
        limit = 5000 if is_test else 60
        window = 60
        key = f"upload:{client_ip}"
    else:
        limit = 5000 if is_test else 600
        window = 60
        key = f"general:{client_ip}"

    is_limited, retry_after = limiter.is_rate_limited(key, limit, window)
    if is_limited:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too Many Requests: Rate limit exceeded. Please retry later.",
                "retry_after_seconds": retry_after
            },
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0"
            }
        )

    response = await call_next(request)
    remaining = limiter.get_remaining(key, limit, window)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response
