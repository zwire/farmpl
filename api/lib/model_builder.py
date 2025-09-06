from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from .constants import AREA_SCALE_UNITS_PER_A
from .interfaces import Constraint, Objective
from .schemas import PlanRequest
from .variables import Variables, create_empty_variables


@dataclass
class BuildContext:
    """Context object passed to constraints/objectives during build."""

    request: PlanRequest
    variables: Variables
    model: cp_model.CpModel
    # scale: 1 unit = 0.1a (integerize area)
    scale_area: int = AREA_SCALE_UNITS_PER_A
    objective_expr: cp_model.LinearExpr | None = None
    objective_sense: str | None = None  # "max" or "min"


def build_model(
    request: PlanRequest, constraints: list[Constraint], objectives: list[Objective]
) -> BuildContext:
    model = cp_model.CpModel()
    variables = create_empty_variables()
    ctx = BuildContext(request=request, variables=variables, model=model)

    for c in constraints:
        if getattr(c, "enabled", True):
            c.apply(ctx)

    # Only first objective is applied per solve
    if objectives:
        obj = objectives[0]
        if getattr(obj, "enabled", True):
            obj.register(ctx)
            if ctx.objective_expr is not None:
                if ctx.objective_sense == "max":
                    model.Maximize(ctx.objective_expr)
                elif ctx.objective_sense == "min":
                    model.Minimize(ctx.objective_expr)

    return ctx
