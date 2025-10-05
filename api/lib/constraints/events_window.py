from __future__ import annotations

from ortools.sat.python import cp_model

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

            # Lag dependency: e can only occur Lmin..Lmax days after predecessor p,
            # and must be at least Lmin days after the MOST RECENT p.
            if ev.preceding_event_id and (ev.lag_min_days or ev.lag_max_days):
                p = ev.preceding_event_id
                Lmin = int(ev.lag_min_days or 0)
                Lmax = int(ev.lag_max_days or Lmin)
                for t in range(1, H + 1):
                    rt = ctx.variables.r_event_by_e_t[(ev.id, t)]
                    # If not enough days have elapsed to satisfy Lmin, forbid rt
                    if Lmin > 0 and (t - Lmin) < 1:
                        model.Add(rt == 0)
                        continue
                    from_t = max(1, t - Lmax)
                    to_t = t - Lmin
                    if to_t < from_t:
                        model.Add(rt == 0)
                        continue
                    preds = [
                        ctx.variables.r_event_by_e_t.setdefault(
                            (p, tau), model.NewBoolVar(f"r_{p}_{tau}")
                        )
                        for tau in range(from_t, to_t + 1)
                    ]
                    # Require at least one predecessor in the window
                    model.Add(rt <= sum(preds))
                    # Additionally, enforce "no predecessor in the last Lmin days"
                    # so that the lag is computed from the most recent p.
                    if Lmin > 0:
                        recent_from = max(1, t - Lmin + 1)
                        for tau in range(recent_from, t + 1):
                            pvar = ctx.variables.r_event_by_e_t.setdefault(
                                (p, tau), model.NewBoolVar(f"r_{p}_{tau}")
                            )
                            model.Add(rt + pvar <= 1)

        # Occupancy derivation per crop based on uses_land events.
        occ = ctx.variables.occ_by_c_t
        r = ctx.variables.r_event_by_e_t
        occ_l = ctx.variables.occ_by_l_c_t
        for crop in ctx.request.crops:
            use_events = [
                ev
                for ev in ctx.request.events
                if ev.crop_id == crop.id and getattr(ev, "uses_land", False)
            ]
            use_any_by_t: dict[int, cp_model.BoolVar] = {}
            prefix_by_t: dict[int, cp_model.BoolVar] = {}
            suffix_by_t: dict[int, cp_model.BoolVar] = {}

            for t in range(1, H + 1):
                key = (crop.id, t)
                if key not in occ:
                    occ[key] = model.NewBoolVar(f"occ_{crop.id}_{t}")

            if not use_events:
                for t in range(1, H + 1):
                    model.Add(occ[(crop.id, t)] == 0)
                continue

            for t in range(1, H + 1):
                terms = [r[(ev.id, t)] for ev in use_events]
                use_any = model.NewBoolVar(f"occ_use_any_{crop.id}_{t}")
                for term in terms:
                    model.Add(term <= use_any)
                model.Add(sum(terms) >= use_any)
                model.Add(sum(terms) <= len(terms) * use_any)
                use_any_by_t[t] = use_any
                prefix_by_t[t] = model.NewBoolVar(f"occ_prefix_{crop.id}_{t}")
                suffix_by_t[t] = model.NewBoolVar(f"occ_suffix_{crop.id}_{t}")

            # Prefix: has any use event occurred by day t?
            model.Add(prefix_by_t[1] == use_any_by_t[1])
            for t in range(2, H + 1):
                model.Add(prefix_by_t[t] >= prefix_by_t[t - 1])
                model.Add(prefix_by_t[t] >= use_any_by_t[t])
                model.Add(prefix_by_t[t] <= prefix_by_t[t - 1] + use_any_by_t[t])

            # Suffix: is there a use event from day t onwards?
            model.Add(suffix_by_t[H] == use_any_by_t[H])
            for t in range(H - 1, 0, -1):
                model.Add(suffix_by_t[t] >= suffix_by_t[t + 1])
                model.Add(suffix_by_t[t] >= use_any_by_t[t])
                model.Add(suffix_by_t[t] <= suffix_by_t[t + 1] + use_any_by_t[t])

            for t in range(1, H + 1):
                key = (crop.id, t)
                occ_t = occ[key]
                prefix_t = prefix_by_t[t]
                suffix_t = suffix_by_t[t]
                model.Add(occ_t <= prefix_t)
                model.Add(occ_t <= suffix_t)
                model.Add(occ_t >= prefix_t + suffix_t - 1)

            # Link crop-level occupancy to land-level occupancy indicators
            land_occ_vars_by_t: dict[int, list[cp_model.BoolVar]] = {
                t: [] for t in range(1, H + 1)
            }
            for land in ctx.request.lands:
                for t in range(1, H + 1):
                    key_l = (land.id, crop.id, t)
                    if key_l in occ_l:
                        land_occ_vars_by_t[t].append(occ_l[key_l])
                        model.Add(occ_l[key_l] <= occ[(crop.id, t)])

            for t in range(1, H + 1):
                vars_at_t = land_occ_vars_by_t[t]
                if vars_at_t:
                    model.Add(occ[(crop.id, t)] <= sum(vars_at_t))
                else:
                    # If no land-level occupancy variables exist for this t,
                    # crop-level occupancy must be 0
                    model.Add(occ[(crop.id, t)] == 0)

        # Enforce land-level continuity around blocked intervals
        for land in ctx.request.lands:
            blocked = sorted(land.blocked_days or set())
            if not blocked:
                continue
            H = ctx.request.horizon.num_days
            segments: list[tuple[int, int]] = []
            start = None
            prev = None
            for day in blocked:
                if day < 1 or day > H:
                    continue
                if start is None:
                    start = day
                    prev = day
                    continue
                if day == prev + 1:
                    prev = day
                else:
                    segments.append((start, prev))
                    start = day
                    prev = day
            if start is not None and prev is not None:
                segments.append((start, prev))

            for crop in ctx.request.crops:
                for block_start, block_end in segments:
                    prev_day = block_start - 1
                    next_day = block_end + 1
                    prev_occ = None
                    next_occ = None
                    if prev_day >= 1:
                        prev_occ = occ_l.get((land.id, crop.id, prev_day))
                    if next_day <= H:
                        next_occ = occ_l.get((land.id, crop.id, next_day))
                    for blocked_day in range(block_start, block_end + 1):
                        key_l = (land.id, crop.id, blocked_day)
                        if key_l in occ_l:
                            model.Add(occ_l[key_l] == 0)
