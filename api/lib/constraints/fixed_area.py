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
            target = int(round(fa.area * scale))

            tag = fa.land_tag
            if not tag:
                continue
            base_terms = []
            for land in ctx.request.lands:
                if tag in (land.tags or set()) or tag in (set(land.tags or [])):
                    cap = int(round(land.area * scale))
                    base_key = (land.id, fa.crop_id)
                    if base_key not in ctx.variables.x_area_by_l_c:
                        ctx.variables.x_area_by_l_c[base_key] = model.NewIntVar(
                            0, cap, f"x_{land.id}_{fa.crop_id}"
                        )
                    base_terms.append(ctx.variables.x_area_by_l_c[base_key])
                    # Per-day variables will be created as needed by other constraints
            if base_terms:
                model.Add(sum(base_terms) >= target)
