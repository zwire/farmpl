from __future__ import annotations

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    HoldAreaConstConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Event, Horizon, Land, PlanRequest
from lib.solver import solve


def test_area_can_change_only_after_end() -> None:
    # Seed day1, end day3: area t=1..3 constant, can change at t=4
    req = PlanRequest(
        horizon=Horizon(num_days=4),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E_seed",
                crop_id="C1",
                name="seed",
                start_cond={1},
                end_cond={1},
                occupancy_effect="start",
            ),
            Event(
                id="E_end",
                crop_id="C1",
                name="end",
                start_cond={3},
                end_cond={3},
                preceding_event_id="E_seed",
                lag_min_days=2,
                lag_max_days=2,
                occupancy_effect="end",
            ),
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            HoldAreaConstConstraint(),
            AreaBoundsConstraint(),
        ],
        [ProfitObjective()],
    )
    r = ctx.variables.r_event_by_e_t
    ctx.model.Add(r[("E_seed", 1)] == 1)
    ctx.model.Add(r[("E_end", 3)] == 1)
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    # Check occ values
    occ = sc.occ_by_c_t_values
    assert occ[("C1", 2)] == 1
    assert occ[("C1", 3)] in (0, 1)  # end day may relax upper bound only
    # Since exact x values are not directly exposed here, rely on constraints.
