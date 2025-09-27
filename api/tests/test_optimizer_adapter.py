from __future__ import annotations

from typing import Any

import pytest

from lib.schemas import (
    EventAssignment,
    PlanAssignment,
    PlanDiagnostics,
    PlanRequest,
    PlanResponse,
)
from schemas import (
    ApiCrop,
    ApiEvent,
    ApiHorizon,
    ApiLand,
    ApiPlan,
    OptimizationRequest,
)
from services.optimizer_adapter import solve_sync, to_domain_plan


def _make_api_plan() -> ApiPlan:
    return ApiPlan(
        horizon=ApiHorizon(num_days=3),
        crops=[ApiCrop(id="c1", name="作物", price_per_10a=100000)],
        events=[
            ApiEvent(
                id="e1",
                crop_id="c1",
                name="播種",
                uses_land=True,
            ),
            ApiEvent(
                id="e2",
                crop_id="c1",
                name="収穫",
                preceding_event_id="e1",
                lag_min_days=1,
                lag_max_days=2,
            ),
        ],
        lands=[ApiLand(id="L1", name="畑1", area_10a=1)],
        workers=[],
        resources=[],
    )


def test_to_domain_plan_unit_normalization() -> None:
    api = _make_api_plan()
    pr = to_domain_plan(api)
    # land area: 1[10a] -> 10[a]
    assert pr.lands[0].area == 10
    # price: 100000[円/10a] -> 10000[円/a]
    assert pr.crops[0].price_per_area == 10000


def test_solve_sync_builds_timeline(monkeypatch: pytest.MonkeyPatch) -> None:
    api = _make_api_plan()
    domain_req_captured: dict[str, Any] = {}

    def fake_plan(req: PlanRequest, **kwargs: Any) -> PlanResponse:
        domain_req_captured["value"] = req
        assignment = PlanAssignment(
            crop_area_by_land_day={
                "L1": {
                    0: {"c1": 10.0},
                    1: {"c1": 10.0},
                    2: {"c1": 10.0},
                }
            },
            idle_by_land_day={},
        )
        diags = PlanDiagnostics(feasible=True)
        evs = [
            EventAssignment(
                day=0, event_id="e1", assigned_workers=[], resource_usage=[]
            )
        ]
        return PlanResponse(
            diagnostics=diags,
            assignment=assignment,
            event_assignments=evs,
            objectives={"profit": 123.0},
            summary={"area_total": 30.0},
            constraint_hints=[],
        )

    monkeypatch.setattr("services.optimizer_adapter.run_plan", fake_plan)

    res = solve_sync(OptimizationRequest(plan=api))
    assert res.status == "ok"
    assert res.timeline is not None
    spans = res.timeline.land_spans
    assert len(spans) == 1
    assert spans[0].start_day == 0 and spans[0].end_day == 2 and spans[0].area_a == 10.0
    assert isinstance(domain_req_captured["value"], PlanRequest)
    assert domain_req_captured["value"].lands[0].area == 10.0
