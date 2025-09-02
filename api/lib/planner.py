from __future__ import annotations

from .diagnostics import BasicDiagnostics
from .interfaces import Constraint, Objective
from .model_builder import build_model
from .schemas import PlanAssignment, PlanDiagnostics, PlanRequest, PlanResponse
from .solver import solve


def plan(
    request: PlanRequest,
    constraints: list[Constraint] | None = None,
    objectives: list[Objective] | None = None,
) -> PlanResponse:
    constraints = constraints or []
    objectives = objectives or []

    build_ctx = build_model(request, constraints, objectives)
    solve_ctx = solve(build_ctx)

    diag = BasicDiagnostics().summarize(solve_ctx)
    diagnostics = PlanDiagnostics(
        feasible=False,  # skeleton: not solved yet
        reason="solver not executed",
        violated_constraints=[],
    )

    # skeleton: empty assignment
    assignment = PlanAssignment(crop_area_by_land={})
    return PlanResponse(diagnostics=diagnostics, assignment=assignment)
