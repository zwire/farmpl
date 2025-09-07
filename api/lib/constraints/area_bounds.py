from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class AreaBoundsConstraint(Constraint):
    """Crop area bounds over time (rotation-friendly by default).

    min_area <= Sum_{l,t} x[l,c,t] <= max_area.
    Bounds are optional per crop; only enforced if provided (non-None).
    """

    def apply(self, ctx: BuildContext) -> None:
        if not ctx.request.crop_area_bounds:
            return
        model = ctx.model
        scale = ctx.scale_area

        crop_ids = {c.id for c in ctx.request.crops}

        for b in ctx.request.crop_area_bounds:
            if b.crop_id not in crop_ids:
                continue
            # Enforce bounds per day (stronger, avoids horizon-sum loophole)
            H = ctx.request.horizon.num_days
            lo = None if b.min_area is None else int(round(b.min_area * scale))
            hi = None if b.max_area is None else int(round(b.max_area * scale))
            for t in range(1, H + 1):
                day_sum = sum(
                    ctx.variables.x_area_by_l_c_t[(land.id, b.crop_id, t)]
                    for land in ctx.request.lands
                )
                if lo is not None:
                    model.Add(day_sum >= lo)
                if hi is not None:
                    model.Add(day_sum <= hi)
