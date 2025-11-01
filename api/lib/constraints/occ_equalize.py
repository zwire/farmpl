from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class OccEqualizeConstraint(Constraint):
    """Equalize land-level occupancy with crop-level occupancy when used.

    For each land l, crop c, and day t that is not blocked for l:
    if z[l,c] == 1 (the land uses crop c sometime in the horizon),
    enforce occ_l[c,t] == occ[c,t]. This ties the per-land occupancy timeline to
    the crop's occupancy window, eliminating mid-season gaps on that land and
    preventing sudden land switches for dependent events.

    Notes:
    - Applies only to crops that have at least one uses_land event.
    - Blocked days are excluded; other constraints already force occ_l == 0
      on blocked days.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        # Consider only crops that actually use land via events
        uses_land_crops = {
            ev.crop_id for ev in ctx.request.events if getattr(ev, "uses_land", False)
        }

        for land in ctx.request.lands:
            blocked = land.blocked_days or set()
            for crop in ctx.request.crops:
                if crop.id not in uses_land_crops:
                    continue
                z = ctx.variables.z_use_by_l_c.get((land.id, crop.id))
                if z is None:
                    # Ensure existence for implication guards
                    z = ctx.model.NewBoolVar(f"z_{land.id}_{crop.id}")
                    ctx.variables.z_use_by_l_c[(land.id, crop.id)] = z
                for t in range(1, H + 1):
                    if t in blocked:
                        # blocked-day handling already elsewhere
                        continue
                    occ_crop = ctx.variables.occ_by_c_t.get((crop.id, t))
                    if occ_crop is None:
                        # If occupancy is not modeled for this crop/day, skip
                        continue
                    occ_land = ctx.variables.occ_by_l_c_t.get((land.id, crop.id, t))
                    if occ_land is None:
                        # Land-level occupancy var is created when linking x and occ
                        # (LinkAreaUseConstraint). If absent, skip quietly.
                        continue
                    # If z[l,c]==1, enforce occ_land == occ_crop
                    model.Add(occ_land >= occ_crop).OnlyEnforceIf(z)
                    model.Add(occ_land <= occ_crop).OnlyEnforceIf(z)
