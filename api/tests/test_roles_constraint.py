from __future__ import annotations

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
    RolesConstraint,
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
    Worker,
)
from lib.solver import solve


def test_event_requires_role_infeasible_when_role_absent() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="harvest",
                labor_total_per_area=10.0,
                labor_daily_cap=8.0,
                required_roles={"harvester"},
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w1", capacity_per_day=8.0, roles=set())],
        resources=[],
        fixed_areas=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.5, max_area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
            RolesConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status == "INFEASIBLE"


def test_event_requires_role_feasible_when_role_present() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="harvest",
                labor_total_per_area=10.0,
                labor_daily_cap=8.0,
                required_roles={"harvester"},
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[
            Worker(id="W1", name="w1", capacity_per_day=8.0, roles={"harvester"}),
        ],
        resources=[],
        fixed_areas=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.5, max_area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
            RolesConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")


def test_event_requires_role_exclusive_assignment() -> None:
    # 2 people required but only 1 has the role -> infeasible
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="harvest",
                labor_total_per_area=10.0,
                labor_daily_cap=8.0,
                required_roles={"harvester"},
                people_required=2,
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[
            Worker(id="W1", name="w1", capacity_per_day=8.0, roles={"harvester"}),
            Worker(id="W2", name="w2", capacity_per_day=8.0, roles=set()),
        ],
        resources=[],
        fixed_areas=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.5, max_area=1.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
            EventsWindowConstraint(),
            LaborConstraint(),
            RolesConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status == "INFEASIBLE"
