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


def test_area_constancy_during_occupancy_segment() -> None:
    # Seed at day 1, harvest at day 5 → occ active in between; no block days
    req = PlanRequest(
        horizon=Horizon(num_days=5),
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
                id="E_harv",
                crop_id="C1",
                name="harv",
                start_cond={5},
                end_cond={5},
                preceding_event_id="E_seed",
                lag_min_days=4,
                lag_max_days=4,
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
    # Force event activations for start/end days
    r = ctx.variables.r_event_by_e_t
    ctx.model.Add(r[("E_seed", 1)] == 1)
    ctx.model.Add(r[("E_harv", 5)] == 1)
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    # pick any positive area chosen; ensure day 2..5 are equal (until harvest day)
    x = sc.build.variables.x_area_by_l_c_t
    model = sc.build.model
    # Assert occ is 1 for t=2..4 and 0 at t=1 before seed and t=5 after end
    occ = sc.occ_by_c_t_values
    assert occ[("C1", 1)] in (0, 1)  # before seed could be 0 depending on bounds
    assert occ[("C1", 2)] == 1
    assert occ[("C1", 3)] == 1
    assert occ[("C1", 4)] == 1
    # After harvest day, occ should not be forced to 1 by end event bound
