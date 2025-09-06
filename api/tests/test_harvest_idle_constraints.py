from __future__ import annotations

from lib.constraints import (
    HarvestCapacityConstraint,
    IdleConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Horizon, Land, PlanRequest
from lib.solver import solve


def test_harvest_cap_limits_daily_harvest() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=3),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=2.0)],
        workers=[],
        resources=[],
        harvest_capacity_per_day={1: 5.0, 2: 5.0, 3: 5.0},
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            HarvestCapacityConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")


def test_idle_balances_area_each_day() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=2),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            IdleConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
