from __future__ import annotations

import time
from datetime import date

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
            horizon=ApiHorizon(num_days=2, start_date=date(2025, 1, 1)),
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


def test_optimize_async_happy_path(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    config.reload_settings()

    def fake_solve_sync(
        _req: OptimizationRequest, *, progress_cb=None
    ) -> OptimizationResult:
        # optionally report immediate completion
        if callable(progress_cb):
            try:
                progress_cb(1.0, "done")
            except Exception:
                pass
        return OptimizationResult(
            status="ok", objective_value=1.0, solution={}, stats={}, warnings=[]
        )

    monkeypatch.setattr("services.optimizer_adapter.solve_sync", fake_solve_sync)

    app = create_app()
    client = TestClient(app)

    body = make_request_body().model_dump(mode="json")
    r = client.post("/v1/optimize/async", json=body)
    assert r.status_code == 202, r.text
    job = r.json()
    job_id = job["job_id"]
    assert job_id

    for _ in range(50):
        g = client.get(f"/v1/jobs/{job_id}")
        assert g.status_code == 200
        data = g.json()
        if data["status"] in ("succeeded", "failed", "canceled", "timeout"):
            assert data["status"] == "succeeded"
            assert data["result"]["status"] == "ok"
            break
        time.sleep(0.01)
    else:
        raise AssertionError("job did not finish in time")
