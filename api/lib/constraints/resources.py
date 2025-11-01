from __future__ import annotations

from lib.constants import TIME_SCALE_UNITS_PER_HOUR
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

        # Capacity per resource per day (sparse by event allowed days)
        for res in ctx.request.resources:
            cap = int(round((res.capacity_per_day or 0.0) * TIME_SCALE_UNITS_PER_HOUR))
            for t in range(1, H + 1):
                day_terms = []
                for ev in ctx.request.events:
                    allowed = ctx.allowed_days_by_event.get(ev.id)
                    if allowed is not None and t not in allowed:
                        continue
                    key = (res.id, ev.id, t)
                    # Create only if day is not resource-blocked
                    if res.blocked_days and t in res.blocked_days:
                        continue
                    if key not in ctx.variables.u_time_by_r_e_t:
                        name = f"u_{res.id}_{ev.id}_{t}"
                        ctx.variables.u_time_by_r_e_t[key] = model.NewIntVar(
                            0, cap, name
                        )
                    day_terms.append(ctx.variables.u_time_by_r_e_t[key])
                if day_terms and cap > 0:
                    model.Add(sum(day_terms) <= cap)

        # Link to events' daily work time if the event requires resources.
        # Σ_r u[r,e,t] >= Σ_w h[w,e,t]
        for ev in ctx.request.events:
            require_by_cat = set(
                getattr(ev, "required_resource_categories", set()) or []
            )
            if not require_by_cat:
                continue
            for t in range(1, H + 1):
                lhs_terms = []
                for res in ctx.request.resources:
                    ok = False
                    if require_by_cat:
                        if res.category is not None and res.category in require_by_cat:
                            ok = True
                    if ok:
                        key = (res.id, ev.id, t)
                        u = ctx.variables.u_time_by_r_e_t.get(key)
                        if u is not None:
                            lhs_terms.append(u)
                rhs_terms = []
                for w in ctx.request.workers:
                    h = ctx.variables.h_time_by_w_e_t.get((w.id, ev.id, t))
                    if h is not None:
                        rhs_terms.append(h)
                if lhs_terms and rhs_terms:
                    ctx.model.Add(sum(lhs_terms) >= sum(rhs_terms))
