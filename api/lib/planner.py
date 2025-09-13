from __future__ import annotations

import math

from .constraints import (
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
from .interfaces import Constraint, Objective
from .model_builder import build_model
from .objectives import (
    build_dispersion_expr,
    build_diversity_expr,
    build_idle_expr,
    build_labor_hours_expr,
    build_profit_expr,
)
from .schemas import (
    EventAssignment,
    PlanAssignment,
    PlanDiagnostics,
    PlanRequest,
    PlanResponse,
    ResourceUsageRef,
    WorkerRef,
)
from .solver import solve


def plan(
    request: PlanRequest,
    constraints: list[Constraint] | None = None,
    objectives: list[Objective] | None = None,
    *,
    extra_stages: list[str] | None = None,
    stage_order: list[str] | None = None,
    lock_tolerance_pct: float | None = None,
    lock_tolerance_by: dict[str, float] | None = None,
) -> PlanResponse:
    # Default constraints (partial time-axis introduced)
    base_constraints: list[Constraint] = [
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
    if constraints:
        base_constraints.extend(constraints)

    # Lexicographic stages
    sense_map = {
        "profit": "max",
        "dispersion": "min",
        "labor": "min",
        "idle": "min",
        "diversity": "max",
    }
    if stage_order:
        stage_defs: list[tuple[str, str]] = [
            (name, sense_map.get(name, "min"))
            for name in stage_order
            if name in sense_map
        ]
        if not stage_defs:
            stage_defs = [("profit", "max"), ("dispersion", "min")]
    else:
        stage_defs = [("profit", "max"), ("dispersion", "min")]
        if extra_stages:
            for k in extra_stages:
                if k not in ("profit", "dispersion"):
                    stage_defs.append((k, sense_map.get(k, "min")))

    locks: list[tuple[str, str, int]] = []
    stage_summaries: list[dict] = []
    last_ctx = None
    last_res = None
    reason = None
    tol = float(lock_tolerance_pct or 0.0)
    for name, sense in stage_defs:
        ctx = build_model(request, base_constraints, [])
        # Apply previous locks
        for lname, lsense, val in locks:
            if lname == "profit":
                expr = build_profit_expr(ctx)
            elif lname == "dispersion":
                expr = build_dispersion_expr(ctx)
            elif lname == "labor":
                expr = build_labor_hours_expr(ctx)
            elif lname == "idle":
                expr = build_idle_expr(ctx)
            elif lname == "diversity":
                expr = build_diversity_expr(ctx)
            else:
                continue
            # Apply tolerance (per-stage override > global > 0)
            stage_tol = tol
            if lock_tolerance_by and lname in lock_tolerance_by:
                stage_tol = float(lock_tolerance_by[lname] or 0.0)
            if lsense == "max":
                bound = int(math.floor(val * (1.0 - stage_tol)))
                ctx.model.Add(expr >= bound)
            else:
                bound = int(math.ceil(val * (1.0 + stage_tol)))
                ctx.model.Add(expr <= bound)

        # Register current objective
        if name == "profit":
            obj_expr = build_profit_expr(ctx)
            ctx.model.Maximize(obj_expr)
        elif name == "dispersion":
            obj_expr = build_dispersion_expr(ctx)
            ctx.model.Minimize(obj_expr)
        elif name == "labor":
            obj_expr = build_labor_hours_expr(ctx)
            ctx.model.Minimize(obj_expr)
        elif name == "idle":
            obj_expr = build_idle_expr(ctx)
            ctx.model.Minimize(obj_expr)
        elif name == "diversity":
            obj_expr = build_diversity_expr(ctx)
            ctx.model.Maximize(obj_expr)
        else:
            # Unknown extra stage; skip
            continue

        res = solve(ctx)
        last_ctx = ctx
        last_res = res
        if res.status not in ("FEASIBLE", "OPTIMAL"):
            reason = f"stage '{name}' status={res.status}"
            break
        # lock value and record summary
        val = int(res.objective_value or 0)
        locks.append((name, sense, val))
        stage_summaries.append({"name": name, "sense": sense, "value": val})

    feasible = bool(last_res and last_res.status in ("FEASIBLE", "OPTIMAL"))
    diagnostics = PlanDiagnostics(
        feasible=feasible,
        reason=None if feasible else reason,
        violated_constraints=[],
        stages=stage_summaries,
        stage_order=[name for name, _ in stage_defs],
        lock_tolerance_pct=float(lock_tolerance_pct or 0.0),
        lock_tolerance_by={k: float(v) for k, v in (lock_tolerance_by or {}).items()}
        if lock_tolerance_by
        else None,
    )

    # Build time-indexed assignment from the last stage values
    crop_area_by_land_day: dict[str, dict[int, dict[str, float]]] = {}
    if (
        feasible
        and last_res
        and last_res.x_area_by_l_c_t_values is not None
        and last_ctx
    ):
        scale = last_ctx.scale_area
        for (land_id, crop_id, t), units in last_res.x_area_by_l_c_t_values.items():
            if units <= 0:
                continue
            area = units / scale
            crop_area_by_land_day.setdefault(land_id, {}).setdefault(t, {})[crop_id] = (
                area
            )

    # Build idle per land/day
    idle_by_land_day: dict[str, dict[int, float]] = {}
    if feasible and last_res and last_res.idle_by_l_t_values is not None and last_ctx:
        for (land_id, t), units in last_res.idle_by_l_t_values.items():
            if units <= 0:
                continue
            area = units / last_ctx.scale_area
            idle_by_land_day.setdefault(land_id, {})[t] = area

    assignment = PlanAssignment(
        crop_area_by_land_day=crop_area_by_land_day, idle_by_land_day=idle_by_land_day
    )

    # Build event assignments with workers, resources, and areas
    event_assignments: list[EventAssignment] = []
    sc = last_res
    if sc is not None and sc.r_event_by_e_t_values is not None and last_ctx is not None:
        # Build worker lookup for names/roles
        worker_info = {
            w.id: WorkerRef(id=w.id, name=w.name, roles=sorted(w.roles or set()))
            for w in request.workers
        }
        # Build resource lookup
        res_info = {r.id: r.name for r in request.resources}

        # Precompute crop area by (crop_id, t)
        crop_area_by_t: dict[tuple[str, int], float] = {}
        if sc.x_area_by_l_c_t_values is not None:
            scale = last_ctx.scale_area
            for (land_id, crop_id, t), units in sc.x_area_by_l_c_t_values.items():
                crop_area_by_t[(crop_id, t)] = crop_area_by_t.get((crop_id, t), 0.0) + (
                    units / scale
                )

        pairs = sorted(sc.r_event_by_e_t_values.keys(), key=lambda k: (k[1], k[0]))
        for e_id, t in pairs:
            if sc.r_event_by_e_t_values[(e_id, t)] <= 0:
                continue
            # Workers
            assigned: list[WorkerRef] = []
            if sc.assign_by_w_e_t_values is not None:
                for (w_id, ev_id, tt), av in sc.assign_by_w_e_t_values.items():
                    if ev_id == e_id and tt == t and av > 0:
                        wr = worker_info.get(w_id)
                        if wr is not None:
                            assigned.append(wr)
            # Resources
            resources_used: list[ResourceUsageRef] = []
            if sc.u_time_by_r_e_t_values is not None:
                per_res: dict[str, int] = {}
                for (r_id, ev_id, tt), val in sc.u_time_by_r_e_t_values.items():
                    if ev_id == e_id and tt == t and val > 0:
                        per_res[r_id] = per_res.get(r_id, 0) + val
                for r_id, units in per_res.items():
                    resources_used.append(
                        ResourceUsageRef(
                            id=r_id,
                            name=res_info.get(r_id),
                            used_time_hours=float(units),
                        )
                    )
            # Planted area
            crop_area = None
            ev_crop = next((e.crop_id for e in request.events if e.id == e_id), None)
            if ev_crop is not None:
                crop_area = crop_area_by_t.get((ev_crop, t))

            event_assignments.append(
                EventAssignment(
                    day=t,
                    event_id=e_id,
                    assigned_workers=assigned,
                    resource_usage=resources_used,
                    crop_area_on_day=crop_area,
                )
            )

    return PlanResponse(
        diagnostics=diagnostics,
        assignment=assignment,
        event_assignments=event_assignments,
    )
