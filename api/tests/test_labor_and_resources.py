from __future__ import annotations

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
    ResourcesConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import (
    Crop,
    CropAreaBound,
    Event,
    Horizon,
    Land,
    PlanRequest,
    Resource,
    Worker,
)
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
            AreaBoundsConstraint(),
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


def test_people_required_infeasible_with_single_worker() -> None:
    # Require 2 people but only 1 worker available; fixed area forces labor need > 0
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
                people_required=2,
                start_cond={1, 2},
                end_cond={1, 2},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w1", capacity_per_day=8.0)],
        resources=[],
        fixed_areas=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.3, max_area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status == "INFEASIBLE"


def test_people_required_feasible_with_two_workers() -> None:
    # 2 required, 2 workers available
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="work",
                labor_total_per_area=6.0,
                labor_daily_cap=8.0,
                people_required=2,
                start_cond={1, 2},
                end_cond={1, 2},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[
            Worker(id="W1", name="w1", capacity_per_day=4.0),
            Worker(id="W2", name="w2", capacity_per_day=4.0),
        ],
        resources=[],
        fixed_areas=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.2, max_area=1.0)],
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
