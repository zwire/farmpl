from __future__ import annotations

from lib.constraints import (
    EventsWindowConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
    ResourcesConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Event, Horizon, Land, PlanRequest, Resource, Worker
from lib.solver import solve


def test_event_requires_labor_and_daily_cap() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="work",
                labor_total_per_area=10.0,
                labor_daily_cap=8.0,
                start_cond={1, 2},
                end_cond={1, 2},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w", capacity_per_day=8.0)],
        resources=[],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")


def test_resource_supply_meets_work_when_required() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="harvest",
                labor_total_per_area=1.0,
                labor_daily_cap=8.0,
                required_resources={"R1"},
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w", capacity_per_day=8.0)],
        resources=[Resource(id="R1", name="r", capacity_per_day=8.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
            ResourcesConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
