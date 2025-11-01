from __future__ import annotations

from ortools.sat.python import cp_model

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class RolesConstraint(Constraint):
    """Enforce required roles per event per active day.

    For each event e and day t where r[e,t]=1, for every required role q in e:
      sum_{w with q in roles[w]} assign[w,e,t] >= 1

    Notes:
    - Uses assign[w,e,t] created by LaborConstraint. If missing, creates it and
      links it so that assign <= r[e,t]. This keeps model consistent even if
      constraint order changes.
    - Does not enforce headcount beyond roles; people_required is handled in
      LaborConstraint.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        # Precompute worker roles map
        worker_roles: dict[str, set[str]] = {
            w.id: (w.roles or set()) for w in ctx.request.workers
        }

        for ev in ctx.request.events:
            if not ev.required_roles:
                continue

            allowed_days = ctx.allowed_days_by_event.get(ev.id, set(range(1, H + 1)))
            for t in sorted(allowed_days):
                # Ensure r[e,t] exists
                r = ctx.variables.r_event_by_e_t.get((ev.id, t))
                if r is None:
                    r = model.NewBoolVar(f"r_{ev.id}_{t}")
                    ctx.variables.r_event_by_e_t[(ev.id, t)] = r

                # Build assigns per worker (create if missing and link to r)
                assigns_all: list[tuple[str, cp_model.BoolVarT]] = []
                req_roles = set(ev.required_roles)
                for w in ctx.request.workers:
                    key = (w.id, ev.id, t)
                    assign = ctx.variables.assign_by_w_e_t.get(key)
                    if assign is None:
                        assign = model.NewBoolVar(f"assign_{w.id}_{ev.id}_{t}")
                        ctx.variables.assign_by_w_e_t[key] = assign
                        model.Add(assign <= r)
                    # Exclusivity:
                    # if worker blocked or lacks any required role -> forbid
                    if (w.blocked_days and t in w.blocked_days) or not (
                        (w.roles or set()) & req_roles
                    ):
                        model.Add(assign == 0)
                    else:
                        assigns_all.append((w.id, assign))

                # Exclusivity: Only workers with any of the required roles
                # may be assigned
                # assigns_all already filtered to eligible workers

                # For each required role, require at least one assigned worker
                # having that role
                for role in ev.required_roles:
                    role_assigns = []
                    for wid, assign in assigns_all:
                        if role in worker_roles.get(wid, set()):
                            role_assigns.append(assign)
                    if role_assigns:
                        model.Add(sum(role_assigns) >= 1).OnlyEnforceIf(r)
                    else:
                        # No worker has the role -> impossible when r=1
                        model.Add(r == 0)
