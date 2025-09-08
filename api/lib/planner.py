from __future__ import annotations

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
from .objectives import DispersionObjective, ProfitObjective, build_profit_expr
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

    # Stage 1: maximize profit
    stage1 = build_model(request, base_constraints, [ProfitObjective()])
    result1 = solve(stage1)

    feasible1 = result1.status in ("FEASIBLE", "OPTIMAL")
    if not feasible1:
        diagnostics = PlanDiagnostics(
            feasible=False,
            reason=f"stage1 status={result1.status}",
            violated_constraints=[],
        )
        return PlanResponse(
            diagnostics=diagnostics,
            assignment=PlanAssignment(crop_area_by_land={}),
            event_assignments=[],
        )

    best_profit = int(result1.objective_value or 0)

    # Stage 2: minimize dispersion with profit locked
    stage2 = build_model(request, base_constraints, [DispersionObjective()])
    # Add profit lock constraint
    profit_expr = build_profit_expr(stage2)
    stage2.model.Add(profit_expr >= best_profit)
    result2 = solve(stage2)

    feasible2 = result2.status in ("FEASIBLE", "OPTIMAL")
    diagnostics = PlanDiagnostics(
        feasible=feasible2,
        reason=None if feasible2 else f"stage2 status={result2.status}",
        violated_constraints=[],
    )

    # Build time-indexed assignment from stage2 values
    crop_area_by_land_day: dict[str, dict[int, dict[str, float]]] = {}
    if feasible2 and result2.x_area_by_l_c_t_values is not None:
        scale = stage2.scale_area
        for (land_id, crop_id, t), units in result2.x_area_by_l_c_t_values.items():
            if units <= 0:
                continue
            area = units / scale
            crop_area_by_land_day.setdefault(land_id, {}).setdefault(t, {})[crop_id] = (
                area
            )

    assignment = PlanAssignment(crop_area_by_land_day=crop_area_by_land_day)

    # Build event assignments with workers, resources, and areas
    event_assignments: list[EventAssignment] = []
    sc = result2
    if sc.r_event_by_e_t_values is not None:
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
            scale = stage2.scale_area
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
