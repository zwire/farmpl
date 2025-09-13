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


class LaborHoursObjective(Objective):
    """Minimize total labor time Σ_{w,e,t} h[w,e,t]."""

    def register(self, ctx: BuildContext) -> None:
        terms = list(ctx.variables.h_time_by_w_e_t.values())
        ctx.objective_expr = sum(terms) if terms else 0
        ctx.objective_sense = "min"


def build_dispersion_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    terms = list(ctx.variables.z_use_by_l_c.values())
    return sum(terms) if terms else 0


def build_labor_hours_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    terms = list(ctx.variables.h_time_by_w_e_t.values())
    return sum(terms) if terms else 0


def build_idle_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    terms = list(ctx.variables.idle_by_l_t.values())
    return sum(terms) if terms else 0


def build_diversity_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    # Introduce use_c per crop and link with z[l,c]
    model = ctx.model
    use = ctx.variables.use_by_c
    for crop in ctx.request.crops:
        if crop.id not in use:
            use[crop.id] = model.NewBoolVar(f"use_{crop.id}")
        # use_c <= sum_l z[l,c]
        z_terms = []
        for land in ctx.request.lands:
            z = ctx.variables.z_use_by_l_c.get((land.id, crop.id))
            if z is not None:
                # z <= use_c  (if any land uses crop, use_c must be 1)
                model.Add(z <= use[crop.id])
                z_terms.append(z)
        if z_terms:
            model.Add(use[crop.id] <= sum(z_terms))
        else:
            # No z available -> crop cannot be used
            model.Add(use[crop.id] == 0)
    return sum(use.values()) if use else 0
