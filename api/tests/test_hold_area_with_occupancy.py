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
                uses_land=True,
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
                uses_land=True,
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
    # pick any positive area chosen; ensure occ covers the full interval 1..5
    occ = sc.occ_by_c_t_values
    assert occ[("C1", 1)] == 1
    assert occ[("C1", 2)] == 1
    assert occ[("C1", 3)] == 1
    assert occ[("C1", 4)] == 1
    assert occ[("C1", 5)] == 1
