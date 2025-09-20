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


def test_occupancy_spans_first_to_last_use_event() -> None:
    # uses_land events at day1 and day4 → occ should remain active across day1-4
    req = PlanRequest(
        horizon=Horizon(num_days=4),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E_start",
                crop_id="C1",
                name="start",
                start_cond={1},
                end_cond={1},
                uses_land=True,
            ),
            Event(
                id="E_end",
                crop_id="C1",
                name="end",
                start_cond={4},
                end_cond={4},
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
    r = ctx.variables.r_event_by_e_t
    ctx.model.Add(r[("E_start", 1)] == 1)
    ctx.model.Add(r[("E_end", 4)] == 1)
    sc = solve(ctx)
    assert sc.status in ("FEASIBLE", "OPTIMAL")
    occ = sc.occ_by_c_t_values
    assert occ[("C1", 1)] == 1
    assert occ[("C1", 2)] == 1
    assert occ[("C1", 3)] == 1
    assert occ[("C1", 4)] == 1
