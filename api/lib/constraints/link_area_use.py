from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LinkAreaUseConstraint(Constraint):
    """x[l,c,t] <= area_l * z[l,c] (scaled)."""

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        H = ctx.request.horizon.num_days
        for land in ctx.request.lands:
            cap = int(round(land.area * scale))
            for crop in ctx.request.crops:
                key_z = (land.id, crop.id)
                if key_z not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key_z] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )
                for t in range(1, H + 1):
                    key = (land.id, crop.id, t)
                    if key not in ctx.variables.x_area_by_l_c_t:
                        ctx.variables.x_area_by_l_c_t[key] = model.NewIntVar(
                            0, cap, f"x_{land.id}_{crop.id}_{t}"
                        )
                    model.Add(
                        ctx.variables.x_area_by_l_c_t[key]
                        <= cap * ctx.variables.z_use_by_l_c[key_z]
                    )
