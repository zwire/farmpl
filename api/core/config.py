from __future__ import annotations

import os
from typing import Literal

AuthMode = Literal["none", "api_key", "bearer"]


def _csv(name: str) -> list[str]:
    v = os.getenv(name, "").strip()
    if not v:
        return []
    return [s.strip() for s in v.split(",") if s.strip()]


def auth_mode() -> AuthMode:
    v = os.getenv("AUTH_MODE", "api_key").strip().lower()
    if v in {"none", "api_key", "bearer"}:
        return v  # type: ignore[return-value]
    return "api_key"  # type: ignore[return-value]


def api_keys() -> list[str]:
    return _csv("API_KEYS")


def bearer_tokens() -> list[str]:
    return _csv("BEARER_TOKENS")


def max_json_mb() -> int:
    v = os.getenv("MAX_JSON_MB", "2").strip()
    try:
        iv = int(v)
        return max(1, min(iv, 64))
    except ValueError:
        return 2


def sync_timeout_ms() -> int:
    v = os.getenv("SYNC_TIMEOUT_MS", "30000").strip()
    try:
        iv = int(v)
        return max(100, min(iv, 100000))
    except ValueError:
        return 30000


def cp_num_workers() -> int:
    v = os.getenv("CP_NUM_WORKERS", "0").strip()
    try:
        iv = int(v)
        # 0 lets OR-Tools auto-detect; negative treated as 0
        return max(0, min(iv, 64))
    except ValueError:
        return 0


def async_timeout_s() -> int:
    v = os.getenv("ASYNC_TIMEOUT_S", "1800").strip()
    try:
        iv = int(v)
        return max(10, min(iv, 24 * 3600))
    except ValueError:
        return 1800


def job_backend() -> str:
    return os.getenv("JOB_BACKEND", "inmemory").strip().lower() or "inmemory"


def redis_url() -> str | None:
    url = os.getenv("REDIS_URL", "").strip()
    return url or None


def rate_limit_enabled() -> bool:
    v = os.getenv("RATE_LIMIT_ENABLED", "false").strip().lower()
    return v in {"1", "true", "yes", "on"}


def rate_limit_window_s() -> int:
    v = os.getenv("RATE_LIMIT_WINDOW_S", "60").strip()
    try:
        iv = int(v)
        return max(1, min(iv, 24 * 3600))
    except ValueError:
        return 60


def rate_limit_limit() -> int:
    v = os.getenv("RATE_LIMIT_LIMIT", "60").strip()
    try:
        iv = int(v)
        return max(1, min(iv, 100000))
    except ValueError:
        return 60


def rate_limit_key_mode() -> str:
    v = os.getenv("RATE_LIMIT_KEY_MODE", "ip").strip().lower()
    return v if v in {"ip", "api_key"} else "ip"
