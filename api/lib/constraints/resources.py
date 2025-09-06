from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class ResourcesConstraint(Constraint):
    """Resource capacity and linkage to event work time (partial).

    - Create u[r,e,t] with per-day caps and blocked days.
    - For events that require resources, enforce Σ_r u[r,e,t] >= Σ_w h[w,e,t].
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        # Capacity per resource per day
        for res in ctx.request.resources:
            cap = int(round(res.capacity_per_day or 0))
            for t in range(1, H + 1):
                day_terms = []
                for ev in ctx.request.events:
                    key = (res.id, ev.id, t)
                    if key not in ctx.variables.u_time_by_r_e_t:
                        name = f"u_{res.id}_{ev.id}_{t}"
                        ctx.variables.u_time_by_r_e_t[key] = model.NewIntVar(
                            0, cap, name
                        )
                    u = ctx.variables.u_time_by_r_e_t[key]
                    day_terms.append(u)
                    if res.blocked_days and t in res.blocked_days:
                        model.Add(u == 0)
                if day_terms and cap > 0:
                    model.Add(sum(day_terms) <= cap)

        # Link to events' daily work time if the event requires resources.
        # Σ_r u[r,e,t] >= Σ_w h[w,e,t]
        for ev in ctx.request.events:
            if not ev.required_resources:
                continue
            for t in range(1, H + 1):
                lhs_terms = []
                for res in ctx.request.resources:
                    if ev.required_resources and res.id in ev.required_resources:
                        key = (res.id, ev.id, t)
                        lhs_terms.append(ctx.variables.u_time_by_r_e_t[key])
                rhs_terms = []
                for w in ctx.request.workers:
                    rhs_terms.append(ctx.variables.h_time_by_w_e_t[(w.id, ev.id, t)])
                if lhs_terms and rhs_terms:
                    ctx.model.Add(sum(lhs_terms) >= sum(rhs_terms))
