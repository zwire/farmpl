from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from core import config
from lib.schemas import PlanAssignment, PlanDiagnostics, PlanResponse
from schemas import ApiCrop, ApiEvent, ApiHorizon, ApiLand, ApiPlan, OptimizationRequest


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


def test_auth_api_key_required(monkeypatch):
    # Configure auth mode and valid keys
    monkeypatch.setenv("AUTH_MODE", "api_key")
    monkeypatch.setenv("API_KEYS", "secret1,secret2")
    config.reload_settings()

    # Fast planner
    def fake_plan(*args, **kwargs):
        return PlanResponse(
            diagnostics=PlanDiagnostics(feasible=True),
            assignment=PlanAssignment(crop_area_by_land_day={}),
            event_assignments=[],
            objectives={"profit": 1.23},
            summary={"area_total": 0.0},
            constraint_hints=[],
        )

    monkeypatch.setenv("PYTHONHASHSEED", "0")
    monkeypatch.setattr("services.optimizer_adapter.run_plan", fake_plan)

    app = create_app()
    client = TestClient(app)

    body = make_request_body().model_dump(mode="json")
    # Missing auth → 401
    r = client.post("/v1/optimize", json=body)
    assert r.status_code == 401

    # With valid X-API-Key → 200
    r2 = client.post("/v1/optimize", json=body, headers={"X-API-Key": "secret1"})
    assert r2.status_code == 200
