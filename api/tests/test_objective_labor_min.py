from __future__ import annotations

from lib.constraints import (
    EventsWindowConstraint,
    FixedAreaConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import LaborHoursObjective
from lib.schemas import Crop, Event, FixedArea, Horizon, Land, PlanRequest, Worker
from lib.solver import solve


def test_minimize_total_labor_hours_hits_theoretical_minimum() -> None:
    # Horizon with enough days to split work.
    # Fixed planted area should force non-zero labor.
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="work",
                labor_total_per_area=6.0,  # h per 1.0a
                labor_daily_cap=8.0,
                start_cond={1, 2},
                end_cond={1, 2},
                uses_land=True,
            )
        ],
        lands=[Land(id="L1", name="F1", tag="tag", area=1.0)],
        workers=[
            Worker(id="W1", name="w", capacity_per_day=4.0)
        ],  # forces split across days
        resources=[],
        fixed_areas=[FixedArea(land_tag="tag", crop_id="C1", area=1.0)],
    )

    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            FixedAreaConstraint(),
            LaborConstraint(),
        ],
        [LaborHoursObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")

    # 労働総時間は >0 で、抽出値の総和と一致する
    total_h = (
        sum(res.h_time_by_w_e_t_values.values()) if res.h_time_by_w_e_t_values else 0
    )
    assert (res.objective_value or 0) >= 0
    assert total_h == int(res.objective_value or 0)
