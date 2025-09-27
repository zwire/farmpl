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
    print(request.events)
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

        # Lookup tables for event metadata and per-day land usage
        event_lookup = {event.id: event for event in request.events}

        # Precompute crop area by (crop_id, t)
        crop_area_by_t: dict[tuple[str, int], float] = {}
        land_ids_by_crop_day: dict[tuple[str, int], set[str]] = {}
        if sc.x_area_by_l_c_t_values is not None:
            scale = last_ctx.scale_area
            for (land_id, crop_id, t), units in sc.x_area_by_l_c_t_values.items():
                crop_area_by_t[(crop_id, t)] = crop_area_by_t.get((crop_id, t), 0.0) + (
                    units / scale
                )
                if units > 0:
                    land_ids_by_crop_day.setdefault((crop_id, t), set()).add(land_id)

        pairs = sorted(sc.r_event_by_e_t_values.keys(), key=lambda k: (k[1], k[0]))
        for e_id, t in pairs:
            if sc.r_event_by_e_t_values[(e_id, t)] <= 0:
                continue
            ev_meta = event_lookup.get(e_id)
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
            ev_crop = ev_meta.crop_id if ev_meta is not None else None
            if ev_crop is not None:
                crop_area = crop_area_by_t.get((ev_crop, t))

            # Land allocation (only for events that occupy land)
            land_ids: list[str] = []
            if ev_meta is not None and getattr(ev_meta, "uses_land", False):
                land_ids = sorted(land_ids_by_crop_day.get((ev_meta.crop_id, t), set()))

            event_assignments.append(
                EventAssignment(
                    day=t,
                    event_id=e_id,
                    assigned_workers=assigned,
                    resource_usage=resources_used,
                    crop_area_on_day=crop_area,
                    land_ids=land_ids,
                )
            )

    # Build objective summaries and simple hints
    objectives: dict[str, float] = {}
    summary: dict[str, float] = {}
    hints: list[str] = []

    if feasible and last_res is not None and last_ctx is not None:
        # Profit from per-day areas (max over t per land/crop)
        price_map = {c.id: float(c.price_per_area or 0.0) for c in request.crops}
        scale = last_ctx.scale_area
        max_by_lc: dict[tuple[str, str], int] = {}
        for (l, c, t), units in (last_res.x_area_by_l_c_t_values or {}).items():
            key = (l, c)
            if units > max_by_lc.get(key, 0):
                max_by_lc[key] = units
        profit_val = 0.0
        for (l, c), units in max_by_lc.items():
            profit_val += price_map.get(c, 0.0) * (units / scale)
        objectives["profit"] = round(profit_val, 3)
        # Dispersion
        objectives["dispersion"] = float(
            sum((last_res.z_use_by_l_c_values or {}).values())
        )
        # Labor
        labor_total = float(sum((last_res.h_time_by_w_e_t_values or {}).values()))
        objectives["labor"] = labor_total
        # Idle
        idle_units = float(sum((last_res.idle_by_l_t_values or {}).values()))
        objectives["idle"] = round(idle_units / scale, 3)
        # Diversity (#crops used)
        used_crops = {
            c for (l, c), z in (last_res.z_use_by_l_c_values or {}).items() if z > 0
        }
        objectives["diversity"] = float(len(used_crops))

        # Numeric summaries
        total_worker_capacity = (
            sum(float(w.capacity_per_day or 0.0) for w in request.workers)
            * request.horizon.num_days
        )
        assigned_res = float(sum((last_res.u_time_by_r_e_t_values or {}).values()))
        total_res_capacity = (
            sum(float(r.capacity_per_day or 0.0) for r in request.resources)
            * request.horizon.num_days
        )
        summary = {
            "workers.capacity_total_h": round(total_worker_capacity, 3),
            "workers.assigned_total_h": labor_total,
            "resources.capacity_total_h": round(total_res_capacity, 3),
            "resources.assigned_total_h": assigned_res,
        }
    else:
        # Heuristic hints on infeasibility
        required_roles = set().union(
            *[e.required_roles or set() for e in request.events]
        )
        have_roles = (
            set().union(*[w.roles or set() for w in request.workers])
            if request.workers
            else set()
        )
        for r in sorted(required_roles - have_roles):
            hints.append(f"missing role: {r}")
        required_res_ids = set().union(
            *[e.required_resources or set() for e in request.events]
        )
        have_res_ids = {r.id for r in request.resources}
        for rid in sorted(required_res_ids - have_res_ids):
            hints.append(f"missing resource: {rid}")
        max_land_area = sum(l.area for l in request.lands)
        for b in request.crop_area_bounds or []:
            if b.min_area is not None and b.min_area > max_land_area:
                hints.append(
                    f"crop {b.crop_id} min_area {b.min_area} > total_land {max_land_area}"
                )
        for fa in request.fixed_areas or []:
            land = next((ld for ld in request.lands if ld.id == fa.land_id), None)
            if land and fa.area > land.area:
                hints.append(
                    f"fixed area {fa.area} for {fa.land_id}/{fa.crop_id} > land area {land.area}"
                )

    return PlanResponse(
        diagnostics=diagnostics,
        assignment=assignment,
        event_assignments=event_assignments,
        objectives=objectives,
        summary=summary,
        constraint_hints=hints,
    )
