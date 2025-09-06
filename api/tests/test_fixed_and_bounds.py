from __future__ import annotations

from lib.constraints import (
    AreaBoundsConstraint,
    FixedAreaConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, CropAreaBound, FixedArea, Horizon, Land, PlanRequest
from lib.solver import solve


def _sum_x_units(res, crop_id: str) -> int:
    assert res.x_area_by_l_c_t_values is not None
    return sum(
        units
        for (l, c, _t), units in res.x_area_by_l_c_t_values.items()
        if c == crop_id
    )


def test_fixed_area_constraint_feasible() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.5)],
    )
    ctx = build_model(
        req,
        [LandCapacityConstraint(), LinkAreaUseConstraint(), FixedAreaConstraint()],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    needed = int(round(0.5 * ctx.scale_area))
    assert _sum_x_units(res, "C1") >= needed


def test_fixed_area_constraint_infeasible_when_exceeds_capacity() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=2.0)],
    )
    ctx = build_model(
        req,
        [LandCapacityConstraint(), LinkAreaUseConstraint(), FixedAreaConstraint()],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")


def test_area_bounds_constraint_respected() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.0, max_area=0.7)],
    )
    ctx = build_model(
        req,
        [LandCapacityConstraint(), LinkAreaUseConstraint(), AreaBoundsConstraint()],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    max_units = int(round(0.7 * ctx.scale_area))
    assert _sum_x_units(res, "C1") <= max_units


def test_area_bounds_constraint_infeasible_min_exceeds_capacity() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=1),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=1.5, max_area=None)],
    )
    ctx = build_model(
        req,
        [LandCapacityConstraint(), LinkAreaUseConstraint(), AreaBoundsConstraint()],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")
