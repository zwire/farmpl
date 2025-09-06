from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LinkAreaUseConstraint(Constraint):
    """x[l,c] <= area_l * z[l,c] (scaled)."""

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        for land in ctx.request.lands:
            cap = int(round(land.area * scale))
            for crop in ctx.request.crops:
                key = (land.id, crop.id)
                # Ensure variables exist
                if key not in ctx.variables.x_area_by_l_c:
                    ctx.variables.x_area_by_l_c[key] = model.NewIntVar(
                        0, cap, f"x_{land.id}_{crop.id}"
                    )
                if key not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )
                model.Add(
                    ctx.variables.x_area_by_l_c[key]
                    <= cap * ctx.variables.z_use_by_l_c[key]
                )
