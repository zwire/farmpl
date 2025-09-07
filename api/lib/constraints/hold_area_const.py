from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class HoldAreaConstConstraint(Constraint):
    """Keep x[l,c,t] constant over time segments (except across blocked days).

    For each land l and crop c, enforce x[l,c,t] == x[l,c,t-1] when both days
    are not blocked for land l. This avoids daily jitter of planted area.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        for land in ctx.request.lands:
            blocked = land.blocked_days or set()
            for crop in ctx.request.crops:
                for t in range(2, H + 1):
                    if (t in blocked) or ((t - 1) in blocked):
                        # allow reset across blocked boundaries
                        continue
                    key_t = (land.id, crop.id, t)
                    key_prev = (land.id, crop.id, t - 1)
                    # variables exist due to capacity/link constraints
                    model.Add(
                        ctx.variables.x_area_by_l_c_t[key_t]
                        == ctx.variables.x_area_by_l_c_t[key_prev]
                    )
