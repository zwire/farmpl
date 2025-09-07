from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LinkAreaUseConstraint(Constraint):
    """Link per-day area to binary use flag (rotation-friendly).

    - x[l,c,t] <= area_l * z[l,c]
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        scale = ctx.scale_area

        H = ctx.request.horizon.num_days
        for land in ctx.request.lands:
            cap = int(round(land.area * scale))
            for crop in ctx.request.crops:
                key = (land.id, crop.id)
                # ensure z
                if key not in ctx.variables.z_use_by_l_c:
                    ctx.variables.z_use_by_l_c[key] = model.NewBoolVar(
                        f"z_{land.id}_{crop.id}"
                    )
                # per-day links (also create envelope base x[l,c] for reporting)
                if key not in ctx.variables.x_area_by_l_c:
                    ctx.variables.x_area_by_l_c[key] = model.NewIntVar(
                        0, cap, f"x_{land.id}_{crop.id}"
                    )
                blocked = land.blocked_days or set()
                for t in range(1, H + 1):
                    key_t = (land.id, crop.id, t)
                    if key_t not in ctx.variables.x_area_by_l_c_t:
                        ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                            0, cap, f"x_{land.id}_{crop.id}_{t}"
                        )
                    model.Add(
                        ctx.variables.x_area_by_l_c_t[key_t]
                        <= cap * ctx.variables.z_use_by_l_c[key]
                    )
                    # Link base and per-day equality on non-blocked days
                    if t not in blocked:
                        model.Add(
                            ctx.variables.x_area_by_l_c_t[key_t]
                            == ctx.variables.x_area_by_l_c[key]
                        )
