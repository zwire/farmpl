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


def build_labor_hours_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    """Total labor time Σ_{w,e,t} h[w,e,t] in scaled time units.

    This mirrors LaborHoursObjective.register but exposes a pure expression
    builder so the lexicographic planner can use it in intermediate stages
    and locking constraints.
    """
    terms = list(ctx.variables.h_time_by_w_e_t.values())
    return sum(terms) if terms else 0


def build_dispersion_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    terms = list(ctx.variables.z_use_by_l_c.values())
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


def build_event_span_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    """Minimize active days of land-using events per crop.

    Count only events with uses_land=True. Non-land events are handled by the
    earliness objective so they are executed as early as possible, even if that
    means adding a separate day.
    """
    model = ctx.model
    H = ctx.request.horizon.num_days
    total_terms: list[cp_model.LinearExpr] = []
    r = ctx.variables.r_event_by_e_t
    for crop in ctx.request.crops:
        events = [
            e
            for e in ctx.request.events
            if e.crop_id == crop.id and e.uses_land is False
        ]
        if not events:
            continue
        for t in range(1, H + 1):
            # Collect existing r[e,t] for this (c,t)
            r_terms = []
            for ev in events:
                key = (ev.id, t)
                rv = r.get(key)
                if rv is not None:
                    r_terms.append(rv)
            if not r_terms:
                continue
            a_ct = model.NewBoolVar(f"act_{crop.id}_{t}")
            for rv in r_terms:
                model.Add(rv <= a_ct)
            model.Add(a_ct <= sum(r_terms))
            total_terms.append(a_ct)
    return sum(total_terms) if total_terms else 0


def build_occupancy_span_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    """Minimize total crop occupancy days Σ_{c,t} occ[c,t]."""
    occ = ctx.variables.occ_by_c_t
    terms = list(occ.values())
    return sum(terms) if terms else 0


class EventSpanObjective(Objective):
    def register(self, ctx: BuildContext) -> None:
        ctx.objective_expr = build_event_span_expr(ctx)
        ctx.objective_sense = "min"


class OccupancySpanObjective(Objective):
    def register(self, ctx: BuildContext) -> None:
        ctx.objective_expr = build_occupancy_span_expr(ctx)
        ctx.objective_sense = "min"


def build_earliness_expr(ctx: BuildContext) -> cp_model.LinearExpr:
    """ASAP tie-breaker: minimize sum_{e,t} t * r[e,t].

    Encourages scheduling events as early as feasible within their windows,
    regardless of whether they use land or not.
    """
    H = ctx.request.horizon.num_days
    terms: list[cp_model.LinearExpr] = []
    for (_e_id, t), r in ctx.variables.r_event_by_e_t.items():
        if 1 <= t <= H:
            terms.append(t * r)
    return sum(terms) if terms else 0


class EarlinessObjective(Objective):
    def register(self, ctx: BuildContext) -> None:
        ctx.objective_expr = build_earliness_expr(ctx)
        ctx.objective_sense = "min"
