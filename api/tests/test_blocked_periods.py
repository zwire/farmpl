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


def test_land_blocked_day_forces_zero_area() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(id="E1", crop_id="C1", name="w", start_cond={1, 2}, end_cond={1, 2})
        ],
        lands=[
            Land(id="L1", name="F1", area=1.0, blocked_days={1}),
            Land(id="L2", name="F2", area=1.0),
        ],
        workers=[Worker(id="W1", name="w", capacity_per_day=8.0)],
        resources=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.5, max_area=1.0)],
    )
    ctx = build_model(
        req,
        [LandCapacityConstraint(), LinkAreaUseConstraint(), AreaBoundsConstraint()],
        [ProfitObjective()],
    )
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    # day1 area must be 0 for all crops on L1
    for (land_id, crop_id, t), val in sc.x_area_by_l_c_t_values.items():
        if land_id == "L1" and t == 1:
            assert val == 0


def test_worker_blocked_day_forces_zero_hours() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="work",
                labor_total_per_area=5.0,
                labor_daily_cap=8.0,
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[
            Worker(id="W1", name="w1", capacity_per_day=8.0, blocked_days={1}),
            Worker(id="W2", name="w2", capacity_per_day=8.0),
        ],
        resources=[],
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
        ],
        [ProfitObjective()],
    )
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    # Blocked worker must have 0 hours; others may work
    for (w, e, t), h in sc.h_time_by_w_e_t_values.items():
        if w == "W1":
            assert h == 0


def test_resource_blocked_day_forces_zero_usage() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="harvest",
                labor_total_per_area=2.0,
                labor_daily_cap=8.0,
                required_resources={"R1"},
                start_cond={1},
                end_cond={1},
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w", capacity_per_day=8.0)],
        resources=[Resource(id="R1", name="r", capacity_per_day=8.0, blocked_days={1})],
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
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    # Blocked resource must have 0 usage
    for (r, e, t), u in sc.u_time_by_r_e_t_values.items():
        assert u == 0
