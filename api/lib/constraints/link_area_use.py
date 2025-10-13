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
        uses_land_crops = {
            ev.crop_id for ev in ctx.request.events if getattr(ev, "uses_land", False)
        }

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
                # base envelope x[l,c] for reporting
                if key not in ctx.variables.x_area_by_l_c:
                    ctx.variables.x_area_by_l_c[key] = model.NewIntVar(
                        0, cap, f"x_{land.id}_{crop.id}"
                    )
                base = ctx.variables.x_area_by_l_c[key]
                # base must be 0 when the land-crop is not used
                model.Add(base <= cap * ctx.variables.z_use_by_l_c[key])
                crop_uses_land = crop.id in uses_land_crops
                blocked = land.blocked_days or set()
                # Per-day creation:
                # - If crop has uses_land events, restrict to possible occupancy span
                # - Otherwise (no occupancy model), create for all days to keep
                occ_days = ctx.occ_days_by_crop.get(crop.id, set())
                days_iter = range(1, H + 1) if not occ_days else sorted(occ_days)
                for t in days_iter:
                    key_t = (land.id, crop.id, t)
                    if key_t not in ctx.variables.x_area_by_l_c_t:
                        ctx.variables.x_area_by_l_c_t[key_t] = model.NewIntVar(
                            0, cap, f"x_{land.id}_{crop.id}_{t}"
                        )
                    occ_l = None
                    if crop_uses_land:
                        occ_key = (land.id, crop.id, t)
                        if occ_key not in ctx.variables.occ_by_l_c_t:
                            ctx.variables.occ_by_l_c_t[occ_key] = model.NewBoolVar(
                                f"occ_{land.id}_{crop.id}_{t}"
                            )
                        occ_l = ctx.variables.occ_by_l_c_t[occ_key]
                    model.Add(
                        ctx.variables.x_area_by_l_c_t[key_t]
                        <= cap * ctx.variables.z_use_by_l_c[key]
                    )
                    # Upper bound by base envelope always
                    model.Add(ctx.variables.x_area_by_l_c_t[key_t] <= base)
                    # Tie to base:
                    # - If occupancy is modeled:
                    #   equality only when occ=1 and not blocked
                    if occ_l is not None:
                        model.Add(ctx.variables.x_area_by_l_c_t[key_t] <= cap * occ_l)
                    if t not in blocked:
                        if occ_l is not None:
                            model.Add(
                                ctx.variables.x_area_by_l_c_t[key_t] == base
                            ).OnlyEnforceIf(occ_l)
                        else:
                            # No occupancy modeling: keep original equality
                            model.Add(ctx.variables.x_area_by_l_c_t[key_t] == base)
                    else:
                        if occ_l is not None:
                            model.Add(occ_l == 0)
