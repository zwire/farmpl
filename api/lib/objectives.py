from __future__ import annotations

from ortools.sat.python import cp_model

from .constants import AREA_SCALE_UNITS_PER_A
from .interfaces import Objective
from .model_builder import BuildContext


def build_profit_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    # Profit = sum_{l,c} price_per_area[c] * x[l,c] (area in 'a')
    # We operate on integer area units (0.1a), so use price per unit.
    terms: list[cp_model.LinearExpr] = []
    scale = AREA_SCALE_UNITS_PER_A
    for crop in ctx.request.crops:
        price = crop.price_per_area or 0.0
        price_per_unit = int(round(price / scale))
        if price_per_unit == 0:
            # If too small, skip; alternatively could upscale globally
            continue
        for land in ctx.request.lands:
            key = (land.id, crop.id)
            x_base = ctx.variables.x_area_by_l_c.get(key)
            if x_base is not None:
                terms.append(price_per_unit * x_base)
    return sum(terms) if terms else 0


class ProfitObjective(Objective):
    """Maximize sum_{l,c} price_per_area[c] * x[l,c] (area-based)."""

    def register(self, ctx: BuildContext) -> None:
        ctx.objective_expr = build_profit_expr(ctx)
        ctx.objective_sense = "max"


class DispersionObjective(Objective):
    """Minimize sum_l,c z[l,c] to prefer concentrated planting."""

    def register(self, ctx: BuildContext) -> None:
        terms = list(ctx.variables.z_use_by_l_c.values())
        ctx.objective_expr = sum(terms) if terms else 0
        ctx.objective_sense = "min"
