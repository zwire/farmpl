from __future__ import annotations

from ortools.sat.python import cp_model

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class AreaBoundsConstraint(Constraint):
    """Crop area bounds over horizon: min_area <= Sum_{l,t} x[l,c,t] <= max_area.

    Bounds are optional per crop; only enforced if provided (non-None).
    """

    def apply(self, ctx: BuildContext) -> None:
        if not ctx.request.crop_area_bounds:
            return
        model = ctx.model
        scale = ctx.scale_area
        H = ctx.request.horizon.num_days

        crop_ids = {c.id for c in ctx.request.crops}
        land_ids = {l.id for l in ctx.request.lands}

        for b in ctx.request.crop_area_bounds:
            if b.crop_id not in crop_ids:
                continue
            terms: list[cp_model.LinearExpr] = []
            for l in land_ids:
                for t in range(1, H + 1):
                    terms.append(ctx.variables.x_area_by_l_c_t[(l, b.crop_id, t)])
            if not terms:
                continue
            total = sum(terms)
            if b.min_area is not None:
                model.Add(total >= int(round(b.min_area * scale)))
            if b.max_area is not None:
                model.Add(total <= int(round(b.max_area * scale)))
