from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from core import config


def test_request_id_header_present(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    config.reload_settings()
    app = create_app()
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.headers.get("X-Request-ID")


def test_config_defaults_and_parsing(monkeypatch):
    for k in [
        "MAX_JSON_MB",
        "SYNC_TIMEOUT_MS",
        "ASYNC_TIMEOUT_S",
        "JOB_BACKEND",
        "REDIS_URL",
    ]:
        monkeypatch.delenv(k, raising=False)

    config.reload_settings()
    assert config.max_json_mb() >= 1
    assert config.sync_timeout_ms() >= 100
    assert config.async_timeout_s() >= 10
    assert config.job_backend() == "inmemory"
    assert config.redis_url() is None

    monkeypatch.setenv("MAX_JSON_MB", "8")
    monkeypatch.setenv("SYNC_TIMEOUT_MS", "15000")
    monkeypatch.setenv("ASYNC_TIMEOUT_S", "600")
    monkeypatch.setenv("JOB_BACKEND", "redis")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    config.reload_settings()

    assert config.max_json_mb() == 8
    assert config.sync_timeout_ms() == 15000
    assert config.async_timeout_s() == 600
    assert config.job_backend() == "redis"
    assert config.redis_url() == "redis://localhost:6379/0"
