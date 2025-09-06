from __future__ import annotations

from ortools.sat.python import cp_model

from .interfaces import Objective
from .model_builder import BuildContext


def build_profit_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    # Profit = sum_{c,t} price[c] * harv[c,t] (scaled by scale_area)
    terms: list[cp_model.LinearExpr] = []
    price_by_crop = {c.id: int(c.price_per_area or 0) for c in ctx.request.crops}
    H = ctx.request.horizon.num_days
    for crop in ctx.request.crops:
        price = price_by_crop[crop.id]
        if price == 0:
            continue
        for t in range(1, H + 1):
            key = (crop.id, t)
            harv = ctx.variables.harv_by_c_t.get(key)
            if harv is None:
                harv = ctx.model.NewIntVar(0, 10**9, f"harv_{crop.id}_{t}")
                ctx.variables.harv_by_c_t[key] = harv
            terms.append(price * harv * ctx.scale_area)
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
        terms = list(ctx.variables.z_use_by_l_c.values())
        ctx.objective_expr = sum(terms) if terms else 0
        ctx.objective_sense = "min"
