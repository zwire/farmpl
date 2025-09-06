from __future__ import annotations

from lib.constraints import LandCapacityConstraint, LinkAreaUseConstraint
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Horizon, Land, PlanRequest
from lib.solver import solve


def test_land_capacity_limits_total_area() -> None:
    # Setup: 1 land of 1.0a (scale 10), 2 crops. Profit objective pushes to fill.
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[
            Crop(id="C1", name="A", price_per_area=100),
            Crop(id="C2", name="B", price_per_area=100),
        ],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(
        req, [LandCapacityConstraint(), LinkAreaUseConstraint()], [ProfitObjective()]
    )
    res = solve(ctx)

    assert res.status in ("FEASIBLE", "OPTIMAL")
    assert res.x_area_by_l_c_values is not None

    total_units = sum(
        units for (l, _c), units in res.x_area_by_l_c_values.items() if l == "L1"
    )
    # Capacity 1.0a * scale(10) = 10 units
    assert total_units == 10
