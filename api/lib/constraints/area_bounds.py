from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class AreaBoundsConstraint(Constraint):
    """Crop area bounds on base planted area (envelope), plus occupancy link.

    Enforce for each crop c with bounds:
      min_area <= sum_l b[l,c] <= max_area  (where b[l,c] = x_area_by_l_c)
    and if sum_l b[l,c] > 0, require occ[c,t] = 1 for at least one day t.

    This avoids the previous loophole where lower bounds were conditioned on
    occ[c,t] and could be bypassed by keeping occ=0 on all days.
    """

    def apply(self, ctx: BuildContext) -> None:
        if not ctx.request.crop_area_bounds:
            return
        model = ctx.model
        scale = ctx.scale_area

        crop_ids = {c.id for c in ctx.request.crops}

        for bnd in ctx.request.crop_area_bounds:
            c_id = bnd.crop_id
            if c_id not in crop_ids:
                continue
            # Sum of base areas across lands for crop c
            base_terms = []
            z_terms = []
            for land in ctx.request.lands:
                base = ctx.variables.x_area_by_l_c.get((land.id, c_id))
                if base is not None:
                    base_terms.append(base)
                z = ctx.variables.z_use_by_l_c.get((land.id, c_id))
                if z is not None:
                    z_terms.append(z)
            total_base = sum(base_terms) if base_terms else 0

            lo = None if bnd.min_area is None else int(round(bnd.min_area * scale))
            hi = None if bnd.max_area is None else int(round(bnd.max_area * scale))

            if lo is not None:
                model.Add(total_base >= lo)
            if hi is not None:
                model.Add(total_base <= hi)

            # If crop is used (any z=1), force at least one day of occupancy
            # use_c variable (shared container)
            use = ctx.variables.use_by_c
            if c_id not in use:
                use[c_id] = model.NewBoolVar(f"use_{c_id}")
            use_c = use[c_id]
            if z_terms:
                for z in z_terms:
                    model.Add(z <= use_c)
                model.Add(use_c <= sum(z_terms))
            else:
                model.Add(use_c == 0)

            # Occ presence if used
            H = ctx.request.horizon.num_days
            occ_any_terms = []
            for t in range(1, H + 1):
                occ = ctx.variables.occ_by_c_t.get((c_id, t))
                if occ is not None:
                    occ_any_terms.append(occ)
            if occ_any_terms:
                model.Add(sum(occ_any_terms) >= use_c)
