from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
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
                    occupancy_effect="start",
                ),
            ],
            lands=[ApiLand(id="L1", name="畑1", area_a=10)],
            workers=[],
            resources=[],
        )
    )


def test_optimize_sync_endpoint_smoke(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")

    def fake_plan(*args, **kwargs):
        return PlanResponse(
            diagnostics=PlanDiagnostics(feasible=True),
            assignment=PlanAssignment(crop_area_by_land_day={}, idle_by_land_day={}),
            event_assignments=[],
            objectives={"profit": 1.23},
            summary={"area_total": 0.0},
            constraint_hints=[],
        )

    # Patch planner used by adapter
    monkeypatch.setattr("services.optimizer_adapter.run_plan", fake_plan)
    app = create_app()
    client = TestClient(app)
    body = make_request_body().model_dump(mode="json")
    r = client.post("/v1/optimize", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "ok"
