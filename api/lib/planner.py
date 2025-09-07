from __future__ import annotations

from .constraints import (
    AreaBoundsConstraint,
    EventsWindowConstraint,
    FixedAreaConstraint,
    HarvestCapacityConstraint,
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
        HarvestCapacityConstraint(),
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

    # If RolesConstraint is present, try to include event assignments
    event_assignments: list[EventAssignment] = []
    if any(isinstance(c, RolesConstraint) for c in base_constraints):
        sc = result2
        if (
            sc.r_event_by_e_t_values is not None
            and sc.assign_by_w_e_t_values is not None
        ):
            # Build worker lookup for names/roles
            worker_info = {
                w.id: WorkerRef(id=w.id, name=w.name, roles=sorted(w.roles or set()))
                for w in request.workers
            }
            # Collect by (t,e)
            pairs = sorted(sc.r_event_by_e_t_values.keys(), key=lambda k: (k[1], k[0]))
            for e_id, t in pairs:
                if sc.r_event_by_e_t_values[(e_id, t)] <= 0:
                    continue
                assigned: list[WorkerRef] = []
                for (w_id, ev_id, tt), av in sc.assign_by_w_e_t_values.items():
                    if ev_id == e_id and tt == t and av > 0:
                        wr = worker_info.get(w_id)
                        if wr is not None:
                            assigned.append(wr)
                event_assignments.append(
                    EventAssignment(day=t, event_id=e_id, assigned_workers=assigned)
                )

    return PlanResponse(
        diagnostics=diagnostics,
        assignment=assignment,
        event_assignments=event_assignments,
    )
