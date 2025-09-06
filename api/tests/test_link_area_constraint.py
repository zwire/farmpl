from __future__ import annotations

from lib.constraints import LandCapacityConstraint, LinkAreaUseConstraint
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Horizon, Land, PlanRequest
from lib.solver import solve


def test_link_area_enforces_zero_when_z_zero() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(
        req, [LandCapacityConstraint(), LinkAreaUseConstraint()], [ProfitObjective()]
    )

    # Force z=0 and still try to push objective by adding constraint x >= 1
    key_z = ("L1", "C1")
    z = ctx.variables.z_use_by_l_c[key_z]
    # Any day t
    key_x = ("L1", "C1", 1)
    x = ctx.variables.x_area_by_l_c_t[key_x]
    ctx.model.Add(z == 0)
    ctx.model.Add(x >= 1)

    res = solve(ctx)
    # With x <= cap*z and z=0, model must become infeasible because x>=1 contradicts link
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")


def test_link_area_allows_area_when_z_one() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(
        req, [LandCapacityConstraint(), LinkAreaUseConstraint()], [ProfitObjective()]
    )
    key_z = ("L1", "C1")
    z = ctx.variables.z_use_by_l_c[key_z]
    key_x = ("L1", "C1", 1)
    x = ctx.variables.x_area_by_l_c_t[key_x]
    ctx.model.Add(z == 1)
    # cap is 10 units; require at least 5
    ctx.model.Add(x >= 5)

    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    assert res.x_area_by_l_c_t_values is not None
    assert res.x_area_by_l_c_t_values[key_x] >= 5
