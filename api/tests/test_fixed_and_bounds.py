from __future__ import annotations

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    FixedAreaConstraint,
    HoldAreaConstConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, CropAreaBound, FixedArea, Horizon, Land, PlanRequest
from lib.solver import SolveContext, solve


def _base_x_units(res: SolveContext, crop_id: str) -> int:
    # Derive base-like envelope from per-day values: max_t sum_l x[l,c,t]
    assert res.x_area_by_l_c_t_values is not None
    days = sorted({t for (_l, _c, t) in res.x_area_by_l_c_t_values.keys()})
    best = 0
    for t in days:
        s = sum(
            units
            for (l, c, tt), units in res.x_area_by_l_c_t_values.items()
            if c == crop_id and tt == t
        )
        best = max(best, s)
    return best


def test_fixed_area_constraint_feasible() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[
            Crop(id="C1", name="A", price_per_area=100),
            Crop(id="C2", name="B", price_per_area=200),
        ],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.5)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            HoldAreaConstConstraint(),
            FixedAreaConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    needed = int(round(0.5 * ctx.scale_area))
    assert _base_x_units(res, "C1") >= needed


def test_fixed_area_constraint_infeasible_when_exceeds_capacity() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=2.0)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            HoldAreaConstConstraint(),
            FixedAreaConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")


def test_area_bounds_constraint_respected() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[
            Crop(id="C1", name="A", price_per_area=100),
            Crop(id="C2", name="B", price_per_area=200),
        ],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.3, max_area=0.7)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    min_units = int(round(0.3 * ctx.scale_area))
    max_units = int(round(0.7 * ctx.scale_area))
    base = _base_x_units(res, "C1")
    assert base >= min_units
    assert base <= max_units


def test_area_bounds_constraint_infeasible_min_exceeds_capacity() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=1.5, max_area=None)],
    )
    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            AreaBoundsConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)
    assert res.status in ("INFEASIBLE", "MODEL_INVALID")


def test_fixed_area_avoids_blocked_days_with_occupancy() -> None:
    # Land L1 blocked on day 2; fixed area must be achieved on non-blocked days
    req = PlanRequest(
        horizon=Horizon(num_days=3),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0, blocked_days={2})],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.5)],
    )

    # Inject start/end events with occupancy effects
    from lib.schemas import Event

    req.events = [
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
    ]

    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            HoldAreaConstConstraint(),
            FixedAreaConstraint(),
        ],
        [ProfitObjective()],
    )
    # Force start/end activations
    r = ctx.variables.r_event_by_e_t
    ctx.model.Add(r[("E_seed", 1)] == 1)
    ctx.model.Add(r[("E_end", 3)] == 1)

    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    assert res.x_area_by_l_c_t_values is not None
    # Blocked day must be zero
    assert res.x_area_by_l_c_t_values[("L1", "C1", 2)] == 0
    # Base envelope must be reached via non-blocked days
    needed = int(round(0.5 * ctx.scale_area))
    assert _base_x_units(res, "C1") >= needed


def test_fixed_area_and_bounds_with_blocked_days_feasible() -> None:
    # Combine fixed area and crop bounds; land day2 is blocked but should be feasible
    req = PlanRequest(
        horizon=Horizon(num_days=5),
        crops=[Crop(id="C1", name="A", price_per_area=100)],
        events=[],
        lands=[Land(id="L1", name="F1", area=1.0, blocked_days={2})],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.3)],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.2, max_area=0.6)],
    )
    # Add start/end occupancy
    from lib.schemas import Event

    req.events = [
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
            start_cond={4},
            end_cond={4},
            preceding_event_id="E_seed",
            lag_min_days=3,
            lag_max_days=3,
            occupancy_effect="end",
        ),
    ]

    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            EventsWindowConstraint(),
            HoldAreaConstConstraint(),
            FixedAreaConstraint(),
            AreaBoundsConstraint(),
        ],
        [ProfitObjective()],
    )
    r = ctx.variables.r_event_by_e_t
    ctx.model.Add(r[("E_seed", 1)] == 1)
    ctx.model.Add(r[("E_end", 4)] == 1)

    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
    assert res.x_area_by_l_c_t_values is not None
    # Blocked day 2 must be zero
    assert res.x_area_by_l_c_t_values[("L1", "C1", 2)] == 0
