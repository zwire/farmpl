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

        # Occupancy derivation per crop from events with effects start/hold/end
        # Approximation rules (Bool):
        #  occ_t <= prev + start_any + hold_any
        #  occ_t >= prev,  occ_t >= start_any,  occ_t >= hold_any
        #  End resets unless new start/hold: occ_t <= (1 - end_any) + start_any + hold_any
        occ = ctx.variables.occ_by_c_t
        for crop in ctx.request.crops:
            prev = None
            for t in range(1, H + 1):
                key = (crop.id, t)
                if key not in occ:
                    occ[key] = model.NewBoolVar(f"occ_{crop.id}_{t}")
                # Collect effects at t
                start_terms = []
                hold_terms = []
                end_terms = []
                for ev in ctx.request.events:
                    if ev.crop_id != crop.id:
                        continue
                    eff = getattr(ev, "occupancy_effect", None)
                    if eff == "start":
                        start_terms.append(
                            ctx.variables.r_event_by_e_t.get(
                                (ev.id, t), model.NewBoolVar(f"r_{ev.id}_{t}")
                            )
                        )
                    elif eff == "hold":
                        hold_terms.append(
                            ctx.variables.r_event_by_e_t.get(
                                (ev.id, t), model.NewBoolVar(f"r_{ev.id}_{t}")
                            )
                        )
                    elif eff == "end":
                        end_terms.append(
                            ctx.variables.r_event_by_e_t.get(
                                (ev.id, t), model.NewBoolVar(f"r_{ev.id}_{t}")
                            )
                        )
                # OR indicators
                start_any = None
                hold_any = None
                end_any = None
                if start_terms:
                    start_any = model.NewBoolVar(f"occ_start_any_{crop.id}_{t}")
                    for st in start_terms:
                        model.Add(st <= start_any)
                    model.Add(sum(start_terms) >= start_any)
                    model.Add(sum(start_terms) <= len(start_terms) * start_any)
                if hold_terms:
                    hold_any = model.NewBoolVar(f"occ_hold_any_{crop.id}_{t}")
                    for hd in hold_terms:
                        model.Add(hd <= hold_any)
                    model.Add(sum(hold_terms) >= hold_any)
                    model.Add(sum(hold_terms) <= len(hold_terms) * hold_any)
                if end_terms:
                    end_any = model.NewBoolVar(f"occ_end_any_{crop.id}_{t}")
                    for ed in end_terms:
                        model.Add(ed <= end_any)
                    model.Add(sum(end_terms) >= end_any)
                    model.Add(sum(end_terms) <= len(end_terms) * end_any)

                if prev is not None:
                    # Lower bounds
                    model.Add(occ[key] >= prev)
                    if start_any is not None:
                        model.Add(occ[key] >= start_any)
                    if hold_any is not None:
                        model.Add(occ[key] >= hold_any)
                    # Upper bounds
                    rhs = prev
                    if start_any is not None:
                        rhs = rhs + start_any
                    if hold_any is not None:
                        rhs = rhs + hold_any
                    model.Add(occ[key] <= rhs)
                    if end_any is not None:
                        model.Add(occ[key] <= prev + (1 - end_any))
                else:
                    # t == 1: occ can be activated by start/hold at day 1
                    if start_any is not None:
                        model.Add(occ[key] >= start_any)
                    if hold_any is not None:
                        model.Add(occ[key] >= hold_any)
                    # Also cap by (start or hold)
                    cap = None
                    if start_any is not None and hold_any is not None:
                        cap = start_any + hold_any
                    elif start_any is not None:
                        cap = start_any
                    elif hold_any is not None:
                        cap = hold_any
                    if cap is not None:
                        model.Add(occ[key] <= cap)
                prev = occ[key]
