from __future__ import annotations

from lib.constraints import LandCapacityConstraint, LinkAreaUseConstraint
from lib.model_builder import build_model
from lib.objectives import DispersionObjective, build_diversity_expr
from lib.schemas import Crop, Horizon, Land, PlanRequest
from lib.solver import solve


def test_diversity_objective_increases_used_crop_count() -> None:
    # One land, two crops. Dispersion-min prefers z=0 for all.
    # Diversity-max encourages setting z (and thus use_c) for more crops.
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[
            Crop(id="C1", name="A", price_per_area=0),
            Crop(id="C2", name="B", price_per_area=0),
        ],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )

    constraints = [LandCapacityConstraint(), LinkAreaUseConstraint()]

    # Baseline: dispersion -> minimize sum z => expect all z=0
    ctx_disp = build_model(req, constraints, [DispersionObjective()])
    res_disp = solve(ctx_disp)
    assert res_disp.status in ("FEASIBLE", "OPTIMAL")
    used_pairs_disp = (
        sum(res_disp.z_use_by_l_c_values.values())
        if res_disp.z_use_by_l_c_values
        else 0
    )
    assert used_pairs_disp == 0

    # Diversity-max
    ctx_div = build_model(req, constraints, [])
    obj_expr = build_diversity_expr(ctx_div)
    ctx_div.model.Maximize(obj_expr)
    res_div = solve(ctx_div)
    assert res_div.status in ("FEASIBLE", "OPTIMAL")
    # Expect at least one z per crop gets activated (since no penalty)
    used_pairs_div = (
        sum(res_div.z_use_by_l_c_values.values()) if res_div.z_use_by_l_c_values else 0
    )
    assert used_pairs_div >= 2  # two crops -> at least 2 pairs when single land
