from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LandCapacityConstraint(Constraint):
    """Sum_c x[l,c,t] <= area_l for each land l and day t (scaled)."""

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        # Ensure variables exist and bounds are set based on land area (per day)
        H = ctx.request.horizon.num_days
        for land in ctx.request.lands:
            for crop in ctx.request.crops:
                key = (land.id, crop.id)
                if key not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )
                for t in range(1, H + 1):
                    key_t = (land.id, crop.id, t)
                    if key_t not in ctx.variables.x_area_by_l_c_t:
                        ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                            0,
                            int(round(land.area * scale)),
                            f"x_{land.id}_{crop.id}_{t}",
                        )

        # Capacity per land per day (+ blocked days => x=0)
        for land in ctx.request.lands:
            blocked = land.blocked_days or set()
            for t in range(1, H + 1):
                if blocked and t in blocked:
                    # Force all x to 0
                    for crop in ctx.request.crops:
                        model.Add(
                            ctx.variables.x_area_by_l_c_t[(land.id, crop.id, t)] == 0
                        )
                else:
                    model.Add(
                        sum(
                            ctx.variables.x_area_by_l_c_t[(land.id, crop.id, t)]
                            for crop in ctx.request.crops
                        )
                        <= int(round(land.area * scale))
                    )
