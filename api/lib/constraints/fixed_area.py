from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class FixedAreaConstraint(Constraint):
    """Enforce fixed planted area as a completion target linked to occupancy.

    Introduce base area b[l,c] (envelope) and ensure:
    - b[l,c] >= fixed_area[l,c]
    - If occ[c,t]==1 and land not blocked, x[l,c,t] == b[l,c]
    - Else 0 <= x[l,c,t] <= b[l,c]
    - If b[l,c] > 0 then some occ[c,t]==1 over horizon (implicit via equality)
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
            H = ctx.request.horizon.num_days

            # Ensure per-day vars exist and collect terms
            terms = []
            for t in range(1, H + 1):
                key_t = (fa.land_id, fa.crop_id, t)
                if key_t not in ctx.variables.x_area_by_l_c_t:
                    ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                        0, cap, f"x_{fa.land_id}_{fa.crop_id}_{t}"
                    )
                terms.append(ctx.variables.x_area_by_l_c_t[key_t])

            # Base envelope b[l,c]
            base_key = (fa.land_id, fa.crop_id)
            if base_key not in ctx.variables.x_area_by_l_c:
                ctx.variables.x_area_by_l_c[base_key] = model.NewIntVar(
                    0, cap, f"x_{fa.land_id}_{fa.crop_id}"
                )
            b = ctx.variables.x_area_by_l_c[base_key]
            model.Add(b >= target)

            # Link to occupancy: when occ=1 and not blocked, x == b; else x <= b
            land = next(ld for ld in ctx.request.lands if ld.id == fa.land_id)
            blocked = land.blocked_days or set()
            for t in range(1, H + 1):
                xt = ctx.variables.x_area_by_l_c_t[(fa.land_id, fa.crop_id, t)]
                occ = ctx.variables.occ_by_l_c_t.get((fa.land_id, fa.crop_id, t))
                if occ is None:
                    # If occ not modeled for this crop/day yet, skip equality; keep upper bound
                    model.Add(xt <= b)
                    continue
                # Upper bound always
                model.Add(xt <= b)
                # Equality only when not blocked and occ=1
                if t not in blocked:
                    model.Add(xt == b).OnlyEnforceIf(occ)

            # Ensure some presence when b>0: sum_t x_t >= b is a simple sufficient condition
            model.Add(sum(terms) >= b)
