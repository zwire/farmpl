from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LandCapacityConstraint(Constraint):
    """Sum_c x[l,c] <= area_l for each land l (scaled)."""

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        # Ensure variables exist and bounds are set based on land area
        for land in ctx.request.lands:
            for crop in ctx.request.crops:
                key = (land.id, crop.id)
                if key not in ctx.variables.x_area_by_l_c:
                    ctx.variables.x_area_by_l_c[key] = model.NewIntVar(
                        0, int(round(land.area * scale)), f"x_{land.id}_{crop.id}"
                    )
                if key not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )

        # Capacity per land
        for land in ctx.request.lands:
            model.Add(
                sum(
                    ctx.variables.x_area_by_l_c[(land.id, crop.id)]
                    for crop in ctx.request.crops
                )
                <= int(round(land.area * scale))
            )
