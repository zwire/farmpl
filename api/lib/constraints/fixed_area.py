from __future__ import annotations

from ortools.sat.python import cp_model

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class FixedAreaConstraint(Constraint):
    """Enforce Sum_t x[l,c,t] >= fixed_area[l,c] for provided pairs.

    Units: input area is in 'a'; internal x is in scaled units (ctx.scale_area).
    """

    def apply(self, ctx: BuildContext) -> None:
        if not ctx.request.fixed_areas:
            return
        model = ctx.model
        scale = ctx.scale_area
        H = ctx.request.horizon.num_days

        # Build quick set for existence
        land_ids = {l.id for l in ctx.request.lands}
        crop_ids = {c.id for c in ctx.request.crops}

        for fa in ctx.request.fixed_areas:
            if fa.land_id not in land_ids or fa.crop_id not in crop_ids:
                continue
            terms: list[cp_model.LinearExpr] = []
            for t in range(1, H + 1):
                terms.append(ctx.variables.x_area_by_l_c_t[(fa.land_id, fa.crop_id, t)])
            rhs = int(round(fa.area * scale))
            if terms:
                model.Add(sum(terms) >= rhs)
