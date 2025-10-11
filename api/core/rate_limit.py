from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse

from .config import Settings


@dataclass
class _Counter:
    start: int
    count: int


class RateLimiter:
    def __init__(
        self,
        enabled: bool,
        window_s: int,
        limit: int,
        key_mode: str,
    ) -> None:
        self.enabled = enabled
        self.window_s = window_s
        self.limit = limit
        self.key_mode = key_mode
        self._lock = threading.Lock()
        self._counters: dict[str, _Counter] = {}

    @classmethod
    def from_settings(cls, settings: Settings) -> RateLimiter:
        return cls(
            enabled=settings.rate_limit_enabled,
            window_s=settings.rate_limit_window_s,
            limit=settings.rate_limit_limit,
            key_mode=settings.rate_limit_key_mode,
        )

    def _rate_key(self, request: Request) -> str:
        if self.key_mode == "api_key":
            key = request.headers.get("X-API-Key")
            if not key:
                auth = request.headers.get("Authorization", "")
                if auth.startswith("ApiKey "):
                    key = auth.removeprefix("ApiKey ")
            if key:
                return f"api:{key}"
        client = request.client.host if request.client else "unknown"
        return f"ip:{client}"

    def _update_counter(self, key: str, now: int) -> tuple[int, int]:
        with self._lock:
            counter = self._counters.get(key)
            if counter is None or now - counter.start >= self.window_s:
                counter = _Counter(start=now, count=0)
            counter.count += 1
            self._counters[key] = counter

            # simple GC: drop old entries
            expired = [
                k for k, c in self._counters.items() if now - c.start >= self.window_s
            ]
            for k in expired:
                if k != key:
                    self._counters.pop(k, None)

            return counter.start, counter.count

    async def middleware(
        self, request: Request, call_next: Callable[[Request], JSONResponse]
    ) -> JSONResponse:
        if not self.enabled:
            return await call_next(request)

        now = int(time.time())
        key = self._rate_key(request)
        start, count = self._update_counter(key, now)

        remaining = max(0, self.limit - count)
        reset_in = max(0, start + self.window_s - now)

        if count > self.limit:
            return JSONResponse(
                status_code=429,
                content={
                    "type": "about:blank",
                    "status": 429,
                    "title": "Too Many Requests",
                    "detail": "rate limit exceeded",
                    "retry_after": reset_in,
                },
                headers={
                    "Retry-After": str(reset_in),
                    "X-RateLimit-Limit": str(self.limit),
                    "X-RateLimit-Remaining": str(max(0, remaining)),
                },
            )

        response = await call_next(request)
        response.headers.setdefault("X-RateLimit-Limit", str(self.limit))
        response.headers.setdefault("X-RateLimit-Remaining", str(remaining))
        response.headers.setdefault("X-RateLimit-Reset", str(reset_in))
        return response
