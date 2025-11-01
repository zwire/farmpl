from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

AuthMode = Literal["none", "api_key", "bearer"]


@dataclass(frozen=True)
class Settings:
    auth_mode: AuthMode
    api_keys: tuple[str, ...]
    bearer_tokens: tuple[str, ...]
    max_json_mb: int
    sync_timeout_ms: int
    async_timeout_s: int
    cp_num_workers: int
    job_backend: str
    redis_url: str | None
    rate_limit_enabled: bool
    rate_limit_window_s: int
    rate_limit_limit: int
    rate_limit_key_mode: str
    jobs_table_name: str | None
    job_payload_bucket: str | None
    job_queue_url: str | None
    job_queue_arn: str | None
    jobs_ttl_days: int


def _csv(name: str) -> tuple[str, ...]:
    v = os.getenv(name, "").strip()
    if not v:
        return ()
    return tuple(s.strip() for s in v.split(",") if s.strip())


def _load_api_keys() -> tuple[str, ...]:
    # 1) 明示的に環境変数 API_KEYS を優先
    raw = os.getenv("API_KEYS", "").strip()
    if raw:
        return tuple(s.strip() for s in raw.split(",") if s.strip())

    # 2) Secrets Manager からの読み取り（API_KEYS_SECRET_ARN が設定されている場合）
    arn = os.getenv("API_KEYS_SECRET_ARN", "").strip()
    if not arn:
        return ()
    try:
        import boto3  # lazy import

        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or None
        sm = boto3.client("secretsmanager", region_name=region)
        resp = sm.get_secret_value(SecretId=arn)
        if "SecretString" in resp:
            data = json.loads(resp["SecretString"])  # {"keys": ["..."]}
        else:  # pragma: no cover - binary secret not expected, but handle defensively
            import base64

            data = json.loads(base64.b64decode(resp["SecretBinary"]))
        keys = data.get("keys", []) if isinstance(data, dict) else []
        return tuple(str(k).strip() for k in keys if str(k).strip())
    except Exception:
        # 読み取り失敗時は空（=すべて401）だが、デプロイ直後などは許容
        return ()


@lru_cache(maxsize=1)
def load_settings() -> Settings:
    auth_raw = os.getenv("AUTH_MODE", "api_key").strip().lower()
    auth_mode: AuthMode
    if auth_raw in {"none", "api_key", "bearer"}:
        auth_mode = auth_raw  # type: ignore[assignment]
    else:
        auth_mode = "api_key"

    def _bounded_int(env: str, default: int, lo: int, hi: int) -> int:
        raw = os.getenv(env, str(default)).strip()
        try:
            val = int(raw)
            return max(lo, min(val, hi))
        except ValueError:
            return default

    return Settings(
        auth_mode=auth_mode,
        api_keys=_load_api_keys(),
        bearer_tokens=_csv("BEARER_TOKENS"),
        max_json_mb=_bounded_int("MAX_JSON_MB", 2, 1, 64),
        sync_timeout_ms=_bounded_int("SYNC_TIMEOUT_MS", 30000, 100, 100000),
        async_timeout_s=_bounded_int("ASYNC_TIMEOUT_S", 1800, 10, 24 * 3600),
        cp_num_workers=_bounded_int("CP_NUM_WORKERS", 0, 0, 64),
        job_backend=(
            os.getenv("JOB_BACKEND", "inmemory").strip().lower() or "inmemory"
        ),
        redis_url=(url if (url := os.getenv("REDIS_URL", "").strip()) else None),
        rate_limit_enabled=os.getenv("RATE_LIMIT_ENABLED", "false").strip().lower()
        in {"1", "true", "yes", "on"},
        rate_limit_window_s=_bounded_int("RATE_LIMIT_WINDOW_S", 60, 1, 24 * 3600),
        rate_limit_limit=_bounded_int("RATE_LIMIT_LIMIT", 60, 1, 100000),
        rate_limit_key_mode=(
            mode
            if (mode := os.getenv("RATE_LIMIT_KEY_MODE", "ip").strip().lower())
            in {"ip", "api_key"}
            else "ip"
        ),
        jobs_table_name=(
            name if (name := os.getenv("JOBS_TABLE_NAME", "").strip()) else None
        ),
        job_payload_bucket=(
            bucket if (bucket := os.getenv("JOB_PAYLOAD_BUCKET", "").strip()) else None
        ),
        job_queue_url=(
            url if (url := os.getenv("JOB_QUEUE_URL", "").strip()) else None
        ),
        job_queue_arn=(
            arn if (arn := os.getenv("JOB_QUEUE_ARN", "").strip()) else None
        ),
        jobs_ttl_days=_bounded_int("JOBS_TTL_DAYS", 365, 1, 3650),
    )


def reload_settings() -> None:
    load_settings.cache_clear()


def settings() -> Settings:
    return load_settings()


def auth_mode() -> AuthMode:
    return settings().auth_mode


def api_keys() -> list[str]:
    return list(settings().api_keys)


def bearer_tokens() -> list[str]:
    return list(settings().bearer_tokens)


def max_json_mb() -> int:
    return settings().max_json_mb


def sync_timeout_ms() -> int:
    return settings().sync_timeout_ms


def cp_num_workers() -> int:
    return settings().cp_num_workers


def async_timeout_s() -> int:
    return settings().async_timeout_s


def job_backend() -> str:
    return settings().job_backend


def redis_url() -> str | None:
    return settings().redis_url


def rate_limit_enabled() -> bool:
    return settings().rate_limit_enabled


def rate_limit_window_s() -> int:
    return settings().rate_limit_window_s


def rate_limit_limit() -> int:
    return settings().rate_limit_limit


def rate_limit_key_mode() -> str:
    return settings().rate_limit_key_mode


def jobs_table_name() -> str | None:
    return settings().jobs_table_name


def job_payload_bucket() -> str | None:
    return settings().job_payload_bucket


def job_queue_url() -> str | None:
    return settings().job_queue_url


def job_queue_arn() -> str | None:
    return settings().job_queue_arn


def jobs_ttl_days() -> int:
    return settings().jobs_ttl_days
