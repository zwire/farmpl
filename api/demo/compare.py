from __future__ import annotations

from collections.abc import Callable
from typing import Any

from lib.constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    FixedAreaConstraint,
    HoldAreaConstConstraint,
    LaborConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
    ResourcesConstraint,
    RolesConstraint,
)
from lib.model_builder import BuildContext, build_model
from lib.objectives import (
    build_diversity_expr,
    build_labor_hours_expr,
    build_profit_expr,
)
from lib.planner import plan
from lib.schemas import PlanRequest
from lib.solver import SolveContext, solve


def run_planner(
    req: PlanRequest,
    extra_stages: list[str] | None = None,
    *,
    stage_order: list[str] | None = None,
    lock_tolerance_pct: float | None = None,
    lock_tolerance_by: dict[str, float] | None = None,
):
    return plan(
        req,
        extra_stages=extra_stages,
        stage_order=stage_order,
        lock_tolerance_pct=lock_tolerance_pct,
        lock_tolerance_by=lock_tolerance_by,
    )


def _base_constraints():
    return [
        LandCapacityConstraint(),
        LinkAreaUseConstraint(),
        EventsWindowConstraint(),
        LaborConstraint(),
        ResourcesConstraint(),
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
    for (land_id, c, _t), units in vals.items():
        key = (land_id, c)
        if units > max_by_lc.get(key, 0):
            max_by_lc[key] = units
    for (_l, c), units in max_by_lc.items():
        by_crop[c] = by_crop.get(c, 0.0) + (units / scale)
    return by_crop


def _build_dispersion_expr(ctx: BuildContext):
    return sum(ctx.variables.z_use_by_l_c.values()) if ctx.variables.z_use_by_l_c else 0


Stage = tuple[str, str, Callable[[BuildContext], Any]]  # (name, sense, expr_builder)


def _run_lexicographic(
    req: PlanRequest,
    stages: list[Stage],
    tol_pct: float = 0.0,
    tol_by: dict[str, float] | None = None,
) -> dict[str, Any]:
    cons = _base_constraints()
    locks: list[tuple[str, str, int]] = []  # (name, sense, value)
    results: dict[str, Any] = {}
    for name, sense, expr_builder in stages:
        ctx = build_model(req, cons, [])
        # apply previous locks
        for lname, lsense, val in locks:
            if lname == "profit":
                expr = build_profit_expr(ctx)
            elif lname == "dispersion":
                expr = _build_dispersion_expr(ctx)
            else:
                continue
            stage_tol = tol_pct
            if tol_by and lname in tol_by:
                stage_tol = float(tol_by[lname] or 0.0)
            if lsense == "max":
                bound = int((1.0 - stage_tol) * int(val))
                ctx.model.Add(expr >= bound)
            else:
                bound = int((1.0 + stage_tol) * int(val))
                ctx.model.Add(expr <= bound)

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


def compare_objectives(
    req: PlanRequest,
    *,
    stage_order: list[str] | None = None,
    lock_tolerance_pct: float | None = None,
    lock_tolerance_by: dict[str, float] | None = None,
) -> dict[str, Any]:
    tol = float(lock_tolerance_pct or 0.0)
    results: dict[str, Any] = {}

    # Default two-stage
    results["two_stage"] = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
        ],
        tol_pct=0.0,
    )

    # If caller specifies a custom order, run exactly that once
    if stage_order:
        order_map = {
            "profit": ("profit", "max", build_profit_expr),
            "dispersion": ("dispersion", "min", _build_dispersion_expr),
            "labor": ("labor", "min", build_labor_hours_expr),
            "diversity": ("diversity", "max", build_diversity_expr),
        }
        stages: list[Stage] = [order_map[s] for s in stage_order if s in order_map]
        tol_by = (
            {k: v / 100.0 for k, v in (lock_tolerance_by or {}).items()}
            if lock_tolerance_by
            else None
        )
        results["custom"] = _run_lexicographic(
            req, stages, tol_pct=tol / 100.0, tol_by=tol_by
        )
        return results

    # Otherwise, run a few illustrative 3-stage scenarios
    results["diversity_before_dispersion"] = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("diversity", "max", build_diversity_expr),
            ("dispersion", "min", _build_dispersion_expr),
        ],
        tol_pct=0.0,
    )
    results["diversity_after_dispersion"] = _run_lexicographic(
        req,
        [
            ("profit", "max", build_profit_expr),
            ("dispersion", "min", _build_dispersion_expr),
            ("diversity", "max", build_diversity_expr),
        ],
        tol_pct=0.0,
    )

    return results
