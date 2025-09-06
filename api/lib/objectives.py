from __future__ import annotations

from ortools.sat.python import cp_model

from .interfaces import Objective
from .model_builder import BuildContext


def build_profit_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    scale = 1  # use raw x units; prices are per area unit of x
    terms: list[cp_model.LinearExpr] = []
    price_by_crop = {c.id: int(c.price_per_area or 0) for c in ctx.request.crops}
    for land in ctx.request.lands:
        for crop in ctx.request.crops:
            key = (land.id, crop.id)
            x = ctx.variables.x_area_by_l_c[key]
            price = price_by_crop[crop.id]
            if price != 0:
                terms.append(price * x * scale)
    if terms:
        return sum(terms)
    return cp_model.LinearExpr.Sum([])


class ProfitObjective(Objective):
    """Maximize sum_l,c price[c] * x[l,c]."""

    def register(self, ctx: BuildContext) -> None:
        ctx.objective_expr = build_profit_expr(ctx)
        ctx.objective_sense = "max"


class DispersionObjective(Objective):
    """Minimize sum_l,c z[l,c] to prefer concentrated planting."""

    def register(self, ctx: BuildContext) -> None:
        terms = [z for z in ctx.variables.z_use_by_l_c.values()]
        ctx.objective_expr = sum(terms) if terms else 0
        ctx.objective_sense = "min"
