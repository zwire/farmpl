from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app


def test_validation_error_shape(monkeypatch):
    # Disable auth to focus on 422
    monkeypatch.setenv("AUTH_MODE", "none")

    app = create_app()
    client = TestClient(app)

    r = client.post("/v1/optimize", json=None)
    assert r.status_code == 422
    data = r.json()
    assert {"status", "title", "detail", "errors"}.issubset(set(data.keys()))
