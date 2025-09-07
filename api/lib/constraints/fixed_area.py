from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class FixedAreaConstraint(Constraint):
    """Enforce fixed planted area per (land, crop) as time-sum.

    Sum_t x[l,c,t] >= area * scale.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        if not ctx.request.fixed_areas:
            return

        for fa in ctx.request.fixed_areas:
            land = next(ld for ld in ctx.request.lands if ld.id == fa.land_id)
            cap = int(round(land.area * scale))
            target = int(round(fa.area * scale))
            # Sum over days lower bound and base equality (non-blocked days)
            H = ctx.request.horizon.num_days
            terms = []
            for t in range(1, H + 1):
                key_t = (fa.land_id, fa.crop_id, t)
                if key_t not in ctx.variables.x_area_by_l_c_t:
                    ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                        0, cap, f"x_{fa.land_id}_{fa.crop_id}_{t}"
                    )
                terms.append(ctx.variables.x_area_by_l_c_t[key_t])
            # Each day cannot exceed land capacity, so horizon-sum is bounded by H*cap.
            # To reflect fixed area as "at least once at the maximum size", bind also base envelope.
            base_key = (fa.land_id, fa.crop_id)
            if base_key not in ctx.variables.x_area_by_l_c:
                ctx.variables.x_area_by_l_c[base_key] = model.NewIntVar(
                    0, cap, f"x_{fa.land_id}_{fa.crop_id}"
                )
            # Enforce base envelope >= target (so base assignment aligns with tests)
            model.Add(ctx.variables.x_area_by_l_c[base_key] >= target)
            # If land day is not blocked, tie base and per-day equality to ensure planted amount shows up
            land = next(ld for ld in ctx.request.lands if ld.id == fa.land_id)
            blocked = land.blocked_days or set()
            for t in range(1, H + 1):
                if t in blocked:
                    continue
                model.Add(
                    ctx.variables.x_area_by_l_c_t[(fa.land_id, fa.crop_id, t)]
                    == ctx.variables.x_area_by_l_c[base_key]
                )
            # And ensure at least one day reaches that base (optional but tightens)
            # sum_t (base - x_t) <= (H-1)*cap  => exists t with x_t >= base - (H-1)*cap
            # Use simple: sum_t x_t >= base (implies some mass over days)
            model.Add(sum(terms) >= ctx.variables.x_area_by_l_c[base_key])
