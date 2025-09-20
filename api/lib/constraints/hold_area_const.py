from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class HoldAreaConstConstraint(Constraint):
    """Keep x[l,c,t] constant while crop occupancy is active.

    For each land l and crop c, if occ[c,t]==1 and both t,t-1 are not blocked
    for the land, enforce x[l,c,t] == x[l,c,t-1]. This ties area constancy to
    modeled occupancy segments rather than all non-blocked days.
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
                    # Enforce constancy only when occupancy is active
                    occ_t = ctx.variables.occ_by_l_c_t.get((land.id, crop.id, t))
                    occ_prev = ctx.variables.occ_by_l_c_t.get(
                        (land.id, crop.id, t - 1)
                    )
                    if occ_t is not None and occ_prev is not None:
                        # If either side is active, keep constant (approx)
                        model.Add(
                            ctx.variables.x_area_by_l_c_t[key_t]
                            == ctx.variables.x_area_by_l_c_t[key_prev]
                        ).OnlyEnforceIf([occ_t])
