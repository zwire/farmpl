from __future__ import annotations

from dataclasses import dataclass, field

from .interfaces import Constraint, Objective
from .schemas import PlanRequest
from .variables import Variables, create_variables


@dataclass
class BuildContext:
    """Context object passed to constraints/objectives during build."""

    request: PlanRequest
    variables: Variables
    # In a full implementation, `model` would be an OR-Tools model instance.
    model: object | None = None
    objective_terms: list[object] = field(default_factory=list)


def build_model(
    request: PlanRequest, constraints: list[Constraint], objectives: list[Objective]
) -> BuildContext:
    variables = create_variables()
    ctx = BuildContext(request=request, variables=variables, model=None)

    for c in constraints:
        if getattr(c, "enabled", True):
            c.apply(ctx)

    for obj in objectives:
        if getattr(obj, "enabled", True):
            obj.register(ctx)

    return ctx
