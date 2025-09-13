from __future__ import annotations

from typing import Any, Callable

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    FixedAreaConstraint,
    HoldAreaConstConstraint,
    IdleConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
    ResourcesConstraint,
    RolesConstraint,
)
from lib.model_builder import BuildContext, build_model
from lib.objectives import build_profit_expr, build_idle_expr, build_diversity_expr
from lib.planner import plan
from lib.schemas import PlanRequest
from lib.solver import SolveContext, solve


def run_planner(
    req: PlanRequest,
    extra_stages: list[str] | None = None,
    *,
    stage_order: list[str] | None = None,
    lock_tolerance_pct: float | None = None,
):
    return plan(
        req,
        extra_stages=extra_stages,
        stage_order=stage_order,
        lock_tolerance_pct=lock_tolerance_pct,
    )


def _base_constraints():
    return [
        LandCapacityConstraint(),
        LinkAreaUseConstraint(),
        EventsWindowConstraint(),
        LaborConstraint(),
        ResourcesConstraint(),
        IdleConstraint(),
        HoldAreaConstConstraint(),
        FixedAreaConstraint(),
        AreaBoundsConstraint(),
        RolesConstraint(),
    ]


def _total_hours(sc: SolveContext) -> int:
    return sum(sc.h_time_by_w_e_t_values.values()) if sc.h_time_by_w_e_t_values else 0


def _crop_base_areas(sc: SolveContext, ctx: BuildContext) -> dict[str, float]:
    by_crop: dict[str, float] = {}
    scale = ctx.scale_area
    vals = sc.x_area_by_l_c_t_values or {}
    max_by_lc: dict[tuple[str, str], int] = {}
    for (l, c, _t), units in vals.items():
        key = (l, c)
        if units > max_by_lc.get(key, 0):
            max_by_lc[key] = units
    for (_l, c), units in max_by_lc.items():
        by_crop[c] = by_crop.get(c, 0.0) + (units / scale)
    return by_crop


def _build_dispersion_expr(ctx: BuildContext):
    return sum(ctx.variables.z_use_by_l_c.values()) if ctx.variables.z_use_by_l_c else 0


def _build_labor_expr(ctx: BuildContext):
    return sum(ctx.variables.h_time_by_w_e_t.values()) if ctx.variables.h_time_by_w_e_t else 0


Stage = tuple[str, str, Callable[[BuildContext], Any]]  # (name, sense, expr_builder)


def _run_lexicographic(req: PlanRequest, stages: list[Stage]) -> dict[str, Any]:
    cons = _base_constraints()
    locks: list[tuple[str, str, int]] = []  # (name, sense, value)
    results: dict[str, Any] = {}
    for (name, sense, expr_builder) in stages:
        ctx = build_model(req, cons, [])
        # apply previous locks
        for (lname, lsense, val) in locks:
            if lname == "profit":
                expr = build_profit_expr(ctx)
            elif lname == "dispersion":
                expr = _build_dispersion_expr(ctx)
            elif lname == "labor":
                expr = _build_labor_expr(ctx)
            else:
                continue
            if lsense == "max":
                ctx.model.Add(expr >= val)
            else:
                ctx.model.Add(expr <= val)

        obj_expr = expr_builder(ctx)
        if sense == "max":
            ctx.model.Maximize(obj_expr)
        else:
            ctx.model.Minimize(obj_expr)

        sc = solve(ctx)
        results[name] = {
            "status": sc.status,
            "value": int(sc.objective_value or 0),
            "total_labor_hours": _total_hours(sc),
            "crop_base_areas": _crop_base_areas(sc, ctx),
        }

        if sc.status not in ("FEASIBLE", "OPTIMAL"):
            break
        locks.append((name, sense, int(sc.objective_value or 0)))

    return results


def compare_objectives(req: PlanRequest) -> dict[str, Any]:
    two_stage = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
        ],
    )

    three_stage_labor = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
            ("labor", "min", _build_labor_expr),
        ],
    )

    three_stage_idle = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
            ("idle", "min", build_idle_expr),
        ],
    )

    three_stage_div = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
            ("diversity", "max", build_diversity_expr),
        ],
    )

    return {
        "two_stage": two_stage,
        "three_stage_labor": three_stage_labor,
        "three_stage_idle": three_stage_idle,
        "three_stage_diversity": three_stage_div,
    }
