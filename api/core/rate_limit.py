from __future__ import annotations

import threading
import time
from typing import Dict, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

from . import config

_lock = threading.Lock()
_counters: Dict[str, Tuple[int, int]] = {}


def _rate_key(request: Request) -> str:
    mode = config.rate_limit_key_mode()
    if mode == "api_key":
        key = request.headers.get("X-API-Key")
        if not key:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("ApiKey "):
                key = auth.replace("ApiKey ", "", 1)
        if key:
            return f"api:{key}"
    client = request.client.host if request.client else "unknown"
    return f"ip:{client}"


async def middleware(request: Request, call_next):
    if not config.rate_limit_enabled():
        return await call_next(request)

    window = config.rate_limit_window_s()
    limit = config.rate_limit_limit()
    now = int(time.time())
    key = _rate_key(request)

    with _lock:
        start, cnt = _counters.get(key, (now, 0))
        if now - start >= window:
            start, cnt = now, 0
        cnt += 1
        _counters[key] = (start, cnt)

    remaining = max(0, limit - cnt)
    reset_in = max(0, start + window - now)

    if cnt > limit:
        return JSONResponse(
            status_code=429,
            content={
                "status": 429,
                "title": "Too Many Requests",
                "detail": "rate limit exceeded",
                "retry_after": reset_in,
            },
            headers={
                "Retry-After": str(reset_in),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": str(max(0, remaining)),
            },
        )

    response = await call_next(request)
    response.headers.setdefault("X-RateLimit-Limit", str(limit))
    response.headers.setdefault("X-RateLimit-Remaining", str(remaining))
    return response
