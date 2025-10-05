from __future__ import annotations

from dataclasses import dataclass, field

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
    # Precomputed day sets to enable sparse variable creation
    # Event ID -> allowed days (coarse window; frequency/lag not expanded)
    allowed_days_by_event: dict[str, set[int]] = field(default_factory=dict)
    # Crop ID -> possible occupancy days (continuous span covering any uses)
    occ_days_by_crop: dict[str, set[int]] = field(default_factory=dict)


def build_model(
    request: PlanRequest, constraints: list[Constraint], objectives: list[Objective]
) -> BuildContext:
    model = cp_model.CpModel()
    variables = create_empty_variables()
    ctx = BuildContext(request=request, variables=variables, model=model)

    # Precompute coarse allowed windows per event and occupancy windows per crop
    H = request.horizon.num_days
    all_days = set(range(1, H + 1))
    # Event windows
    for ev in request.events:
        start_set = ev.start_cond if ev.start_cond is not None else all_days
        end_set = ev.end_cond if ev.end_cond is not None else all_days
        if start_set and end_set:
            lo = min(start_set)
            hi = max(end_set)
            allowed = set(range(max(1, lo), min(H, hi) + 1))
        else:
            allowed = set(all_days)
        ctx.allowed_days_by_event[ev.id] = allowed
    # Crop occupancy windows: span between earliest and latest possible use day
    uses_by_crop: dict[str, list[int]] = {}
    for ev in request.events:
        if getattr(ev, "uses_land", False):
            allowed = ctx.allowed_days_by_event.get(ev.id, set())
            if not allowed:
                continue
            lo = min(allowed)
            hi = max(allowed)
            uses_by_crop.setdefault(ev.crop_id, []).extend([lo, hi])
    for crop in request.crops:
        days: set[int] = set()
        arr = uses_by_crop.get(crop.id)
        if arr and len(arr) >= 2:
            lo = max(1, min(arr))
            hi = min(H, max(arr))
            days = set(range(lo, hi + 1))
        # If no uses_land event, keep empty -> x/occ won't be created unless other
        # constraints require them explicitly
        ctx.occ_days_by_crop[crop.id] = days

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
