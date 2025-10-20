from __future__ import annotations

from lib.constraints import (
    EventsWindowConstraint,
    FixedAreaConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Event, FixedArea, Horizon, Land, PlanRequest
from lib.solver import solve


def test_fixed_area_by_tag_feasible_when_total_area_sufficient() -> None:
    # Two lands tagged 'N'; require 1.0a across the tag
    req = PlanRequest(
        horizon=Horizon(num_days=3),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="occ",
                crop_id="C1",
                name="occ",
                start_cond={1},
                end_cond={3},
                uses_land=True,
            )
        ],
        lands=[
            Land(id="L1", name="F1", area=0.5, tags={"N"}),
            Land(id="L2", name="F2", area=0.7, tags={"N"}),
        ],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_tag="N", crop_id="C1", area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            FixedAreaConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")


def test_fixed_area_by_tag_infeasible_when_exceeds_total_area() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="occ",
                crop_id="C1",
                name="occ",
                start_cond={1},
                end_cond={2},
                uses_land=True,
            )
        ],
        lands=[
            Land(id="L1", name="F1", area=0.2, tags={"N"}),
            Land(id="L2", name="F2", area=0.3, tags={"N"}),
        ],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_tag="N", crop_id="C1", area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            FixedAreaConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")

