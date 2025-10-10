from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from core import config


def test_rate_limit_ip_based(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_WINDOW_S", "60")
    monkeypatch.setenv("RATE_LIMIT_LIMIT", "2")
    monkeypatch.setenv("RATE_LIMIT_KEY_MODE", "ip")
    config.reload_settings()

    app = create_app()
    client = TestClient(app)

    r1 = client.get("/healthz")
    r2 = client.get("/healthz")
    r3 = client.get("/healthz")

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429
    assert r3.json().get("title") == "Too Many Requests"
    assert r3.headers.get("X-RateLimit-Limit") == "2"
