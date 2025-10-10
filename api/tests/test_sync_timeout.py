from __future__ import annotations

import time

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
    OptimizationResult,
)


def make_request_body() -> OptimizationRequest:
    return OptimizationRequest(
        plan=ApiPlan(
            horizon=ApiHorizon(num_days=2),
            crops=[ApiCrop(id="c1", name="作物", price_per_a=1000)],
            events=[ApiEvent(id="e1", crop_id="c1", name="播種", uses_land=True)],
            lands=[ApiLand(id="L1", name="畑1", area_a=10)],
            workers=[],
            resources=[],
        )
    )


def test_sync_timeout_returns_timeout_status(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    monkeypatch.setenv("SYNC_TIMEOUT_MS", "50")
    config.reload_settings()

    def slow_solve(req: OptimizationRequest, *, progress_cb=None) -> OptimizationResult:
        time.sleep(0.2)
        return OptimizationResult(
            status="ok", objective_value=1.0, solution={}, stats={}, warnings=[]
        )

    monkeypatch.setattr("services.optimizer_adapter.solve_sync", slow_solve)

    app = create_app()
    client = TestClient(app)
    body = make_request_body().model_dump(mode="json")
    r = client.post("/v1/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "timeout"
