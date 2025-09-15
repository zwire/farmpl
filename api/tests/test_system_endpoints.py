from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app


def test_healthz_readyz_metrics():
    app = create_app()
    client = TestClient(app)

    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

    r2 = client.get("/readyz")
    assert r2.status_code == 200
    assert "ready" in r2.json()

    r3 = client.get("/metrics")
    assert r3.status_code == 200
    assert r3.headers.get("content-type", "").startswith("text/plain")
