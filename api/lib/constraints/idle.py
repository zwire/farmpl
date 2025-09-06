from __future__ import annotations

from ortools.sat.python import cp_model

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class IdleConstraint(Constraint):
    """Idle per land per day.

    Sum_c x[l,c,t] + idle[l,t] = area_l (for unblocked days)
    idle[l,t] >= 0
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days
        for land in ctx.request.lands:
            cap = int(round(land.area * ctx.scale_area))
            blocked = land.blocked_days or set()
            for t in range(1, H + 1):
                key = (land.id, t)
                if key not in ctx.variables.idle_by_l_t:
                    ctx.variables.idle_by_l_t[key] = model.NewIntVar(
                        0, cap, f"idle_{land.id}_{t}"
                    )
                idle = ctx.variables.idle_by_l_t[key]
                if blocked and t in blocked:
                    model.Add(idle == 0)
                    continue
                terms: list[cp_model.LinearExpr] = []
                for crop in ctx.request.crops:
                    terms.append(ctx.variables.x_area_by_l_c_t[(land.id, crop.id, t)])
                model.Add(sum(terms) + idle == cap)
