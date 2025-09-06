from __future__ import annotations

from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class EventsWindowConstraint(Constraint):
    """Create r[e,t] and restrict activity to allowed windows, frequency, and lags."""

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        for ev in ctx.request.events:
            start_set = (
                ev.start_cond if ev.start_cond is not None else set(range(1, H + 1))
            )
            end_set = ev.end_cond if ev.end_cond is not None else set(range(1, H + 1))

            allowed_days = set(range(1, H + 1)) & set(
                range(min(start_set or {1}), max(end_set or {H}) + 1)
            )

            for t in range(1, H + 1):
                key = (ev.id, t)
                if key not in ctx.variables.r_event_by_e_t:
                    ctx.variables.r_event_by_e_t[key] = model.NewBoolVar(
                        f"r_{ev.id}_{t}"
                    )
                r = ctx.variables.r_event_by_e_t[key]
                if t not in allowed_days:
                    model.Add(r == 0)

            # Frequency: if frequency_days = f, approximate by enforcing gaps
            if ev.frequency_days and ev.frequency_days > 1:
                f = int(ev.frequency_days)
                for t in range(1, H + 1):
                    rt = ctx.variables.r_event_by_e_t[(ev.id, t)]
                    # Prevent two consecutive activations closer than f by:
                    # r[t] + r[t+1] + ... + r[t+f-1] <= 1
                    window_vars = [
                        ctx.variables.r_event_by_e_t[(ev.id, tau)]
                        for tau in range(t, min(H, t + f - 1) + 1)
                    ]
                    if len(window_vars) > 1:
                        model.Add(sum(window_vars) <= 1)

            # Lag dependency: e can only occur Lmin..Lmax days after predecessor p
            if ev.preceding_event_id and (ev.lag_min_days or ev.lag_max_days):
                p = ev.preceding_event_id
                Lmin = int(ev.lag_min_days or 0)
                Lmax = int(ev.lag_max_days or Lmin)
                for t in range(1, H + 1):
                    rt = ctx.variables.r_event_by_e_t[(ev.id, t)]
                    from_t = max(1, t - Lmax)
                    to_t = max(1, t - Lmin)
                    preds = [
                        ctx.variables.r_event_by_e_t.setdefault(
                            (p, tau), model.NewBoolVar(f"r_{p}_{tau}")
                        )
                        for tau in range(from_t, to_t + 1)
                    ]
                    if preds:
                        model.Add(rt <= sum(preds))
