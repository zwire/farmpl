from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LandCapacityConstraint(Constraint):
    """Land capacity constraints (rotation-friendly, time-indexed only).

    - Do not use base x[l,c].
    - Per day capacity: Sum_c x[l,c,t] <= area_l.
    - Blocked days: x[l,c,t] == 0.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        # Bounds set based on land area (do not force-create per-day variables)
        H = ctx.request.horizon.num_days
        for land in ctx.request.lands:
            cap = int(round(land.area * scale))
            for crop in ctx.request.crops:
                key = (land.id, crop.id)
                if key not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )
                # Ensure per-day vars exist for relevant days (see LinkAreaUse)
                occ_days = ctx.occ_days_by_crop.get(crop.id, set())
                days_iter = range(1, H + 1) if not occ_days else sorted(occ_days)
                for t in days_iter:
                    key_t = (land.id, crop.id, t)
                    if key_t not in ctx.variables.x_area_by_l_c_t:
                        ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                            0, cap, f"x_{land.id}_{crop.id}_{t}"
                        )

        # Capacity and links/blocks
        for land in ctx.request.lands:
            cap = int(round(land.area * scale))
            blocked = land.blocked_days or set()
            # Per-day capacity only
            for t in range(1, H + 1):
                if blocked and t in blocked:
                    # Force zero on blocked days (ensure vars exist via loop above)
                    for crop in ctx.request.crops:
                        v = ctx.variables.x_area_by_l_c_t.get((land.id, crop.id, t))
                        if v is not None:
                            model.Add(v == 0)
                else:
                    terms = []
                    for crop in ctx.request.crops:
                        v = ctx.variables.x_area_by_l_c_t.get((land.id, crop.id, t))
                        if v is not None:
                            terms.append(v)
                    if terms:
                        model.Add(sum(terms) <= cap)
