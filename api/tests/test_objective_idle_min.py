from __future__ import annotations

from lib.constraints import (
    IdleConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import DispersionObjective, build_idle_expr
from lib.schemas import Crop, Horizon, Land, PlanRequest
from lib.solver import solve


def test_idle_minimization_reduces_total_idle() -> None:
    # Horizon=1, one land (1.0a), one crop. Dispersion minimizes z -> leads to x=0, idle=cap.
    # Idle-min should push idle to 0 by filling area.
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )

    constraints = [LandCapacityConstraint(), LinkAreaUseConstraint(), IdleConstraint()]

    # Baseline: minimize dispersion (drives z=0 => x=0 => idle=cap)
    ctx_disp = build_model(req, constraints, [DispersionObjective()])
    res_disp = solve(ctx_disp)
    assert res_disp.status in ("FEASIBLE", "OPTIMAL")
    idle_disp = (
        sum(res_disp.idle_by_l_t_values.values()) if res_disp.idle_by_l_t_values else -1
    )
    assert (
        idle_disp >= 1
    )  # cap=1.0a -> 10 units, but solver stores scaled ints; here expect >=1 unit

    # Idle-min objective
    ctx_idle = build_model(req, constraints, [])
    obj_expr = build_idle_expr(ctx_idle)
    ctx_idle.model.Minimize(obj_expr)
    res_idle = solve(ctx_idle)
    assert res_idle.status in ("FEASIBLE", "OPTIMAL")
    total_idle = (
        sum(res_idle.idle_by_l_t_values.values()) if res_idle.idle_by_l_t_values else -1
    )
    assert total_idle == 0
