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
    # Horizon with enough days to split work; ensure fixed planted area forces non-zero labor.
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
                occupancy_effect="hold",
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[Worker(id="W1", name="w", capacity_per_day=4.0)],  # forces split across days
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=1.0)],
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

    # Expect theoretical minimum total hours = 6.0h (1.0a * 6.0 h/a)
    assert int(res.objective_value or -1) == 6

    # Sum extracted h values should match the objective
    total_h = sum(res.h_time_by_w_e_t_values.values()) if res.h_time_by_w_e_t_values else 0
    assert total_h == 6

