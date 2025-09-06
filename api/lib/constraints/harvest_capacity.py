from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class HarvestCapacityConstraint(Constraint):
    """Harvest capacity and peak overflow with partial time variables.

    harv[c,t] is an area-like var (scaled units), bounded by planted area x.
    Σ_c harv[c,t] ≤ harvest_cap_t + over[t].
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days
        scale = ctx.scale_area

        # Precompute planted area per crop per day in units
        sum_x_units_by_crop_t = {}
        for crop in ctx.request.crops:
            for t in range(1, H + 1):
                terms = []
                for land in ctx.request.lands:
                    terms.append(ctx.variables.x_area_by_l_c_t[(land.id, crop.id, t)])
                sum_x_units_by_crop_t[(crop.id, t)] = sum(terms) if terms else 0

        # Build variables harv[c,t] and over[t], then constrain
        for t in range(1, H + 1):
            over = ctx.variables.over_by_t.get(t)
            if over is None:
                ctx.variables.over_by_t[t] = model.NewIntVar(0, 10**9, f"over_{t}")
                over = ctx.variables.over_by_t[t]

            cap_a = 0
            has_cap = ctx.request.harvest_capacity_per_day is not None
            if has_cap and t in ctx.request.harvest_capacity_per_day:
                cap_val = ctx.request.harvest_capacity_per_day[t]
                cap_a = int(round(cap_val * scale))

            day_harv_terms = []
            for crop in ctx.request.crops:
                key = (crop.id, t)
                if key not in ctx.variables.harv_by_c_t:
                    name = f"harv_{crop.id}_{t}"
                    ctx.variables.harv_by_c_t[key] = model.NewIntVar(0, 10**9, name)
                # Bound by planted area of the day
                cap_crop_t = sum_x_units_by_crop_t[(crop.id, t)]
                model.Add(ctx.variables.harv_by_c_t[key] <= cap_crop_t)
                day_harv_terms.append(ctx.variables.harv_by_c_t[key])

            if day_harv_terms and cap_a > 0:
                model.Add(sum(day_harv_terms) <= cap_a + over)
