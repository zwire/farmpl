from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from core import config
from schemas import (
    ApiCrop,
    ApiEvent,
    ApiHorizon,
    ApiLand,
    ApiPlan,
    OptimizationRequest,
)


def make_request_body() -> OptimizationRequest:
    return OptimizationRequest(
        plan=ApiPlan(
            horizon=ApiHorizon(num_days=2),
            crops=[ApiCrop(id="c1", name="作物", price_per_a=1000)],
            events=[
                ApiEvent(
                    id="e1",
                    crop_id="c1",
                    name="播種",
                    uses_land=True,
                ),
            ],
            lands=[ApiLand(id="L1", name="畑1", area_a=10)],
            workers=[],
            resources=[],
        )
    )


def test_optimize_sync(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    monkeypatch.setenv("SYNC_TIMEOUT_MS", "1234")
    config.reload_settings()

    def fake_solver(req: OptimizationRequest, timeout_ms: int | None):
        assert timeout_ms == 1234
        return {"status": "ok"}

    monkeypatch.setattr(
        "services.optimizer_adapter.solve_sync_with_timeout", fake_solver
    )

    app = create_app()
    client = TestClient(app)
    body = make_request_body().model_dump(mode="json")
    r = client.post("/v1/optimize", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "ok"
