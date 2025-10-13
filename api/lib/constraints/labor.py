from __future__ import annotations

from ortools.sat.python import cp_model

from lib.constants import AREA_SCALE_UNITS_PER_A, TIME_SCALE_UNITS_PER_HOUR
from lib.interfaces import Constraint
from lib.model_builder import BuildContext


class LaborConstraint(Constraint):
    """Labor constraints with partial time-axis.

    - Create h[w,e,t] and (optionally) assign[w,e,t] for headcount.
    - Total need per event is computed from x[l,c] and labor_total_per_area.
    - Daily cap per event: sum_w h[w,e,t] <= labor_daily_cap_e * r[e,t].
    - Worker per-day capacity and blocked days enforced.
    """

    def apply(self, ctx: BuildContext) -> None:
        model = ctx.model
        H = ctx.request.horizon.num_days

        # Build map for easy lookups
        H = ctx.request.horizon.num_days
        # Use base envelope per land for crop planted area (not time-sum)
        base_area_sum_by_crop = {}
        for crop in ctx.request.crops:
            terms: list[cp_model.LinearExpr] = []
            for land in ctx.request.lands:
                base_key = (land.id, crop.id)
                x_base = ctx.variables.x_area_by_l_c.get(base_key)
                if x_base is not None:
                    terms.append(x_base)
            base_area_sum_by_crop[crop.id] = sum(terms) if terms else 0

        # For each event, build h and link to needs and daily caps
        for ev in ctx.request.events:
            crop_id = ev.crop_id
            # Exact rational time linearization with scaling.
            # If L = labor_total_per_area (h/a), S_a = AREA_SCALE_UNITS_PER_A,
            # and S_t = TIME_SCALE_UNITS_PER_HOUR (units/hour),
            # per-unit time in scaled units = (L * S_t) / S_a.
            # Let frac = p/q; enforce q * Σ h_scaled[w,e,t] == p * Σ x_units.
            from fractions import Fraction

            L = ev.labor_total_per_area or 0.0
            labor_per_unit_frac = Fraction(str(L)) * TIME_SCALE_UNITS_PER_HOUR / AREA_SCALE_UNITS_PER_A
            p = labor_per_unit_frac.numerator
            q = labor_per_unit_frac.denominator

            # total need numerator side = p * sum_x_units
            sum_x_units = base_area_sum_by_crop.get(crop_id)
            if sum_x_units is None:
                continue
            total_need_num_expr = p * sum_x_units

            allowed_days = ctx.allowed_days_by_event.get(ev.id, set(range(1, H + 1)))
            for t in sorted(allowed_days):
                # r[e,t]
                r = ctx.variables.r_event_by_e_t.get((ev.id, t))
                if r is None:
                    r = ctx.model.NewBoolVar(f"r_{ev.id}_{t}")
                    ctx.variables.r_event_by_e_t[(ev.id, t)] = r

                # Build h[w,e,t]
                daily_sum_terms: list[cp_model.LinearExpr] = []
                for w in ctx.request.workers:
                    # Skip creation on blocked days for sparsity
                    if w.blocked_days and t in w.blocked_days:
                        continue
                    key = (w.id, ev.id, t)
                    cap_w = int(round((w.capacity_per_day or 0.0) * TIME_SCALE_UNITS_PER_HOUR))
                    if key not in ctx.variables.h_time_by_w_e_t:
                        ctx.variables.h_time_by_w_e_t[key] = model.NewIntVar(
                            0, cap_w, f"h_{w.id}_{ev.id}_{t}"
                        )
                    h = ctx.variables.h_time_by_w_e_t[key]
                    # Create assign[w,e,t] for headcount linkage
                    assign_key = (w.id, ev.id, t)
                    if assign_key not in ctx.variables.assign_by_w_e_t:
                        ctx.variables.assign_by_w_e_t[assign_key] = model.NewBoolVar(
                            f"assign_{w.id}_{ev.id}_{t}"
                        )
                    assign = ctx.variables.assign_by_w_e_t[assign_key]
                    if cap_w > 0:
                        model.Add(h <= cap_w * r)
                        # Link hours to assignment: h <= cap_w * assign
                        model.Add(h <= cap_w * assign)
                    # Assignment only when event is taken that day
                    model.Add(assign <= r)
                    daily_sum_terms.append(h)

                daily_sum = sum(daily_sum_terms) if daily_sum_terms else 0

                # Tie activity indicator to actual work time.
                # r[e,t] == 1  <=>  daily_sum >= 1 scaled unit (when variables exist)
                # If no worker vars exist that day, forbid r[e,t]=1.
                if daily_sum_terms:
                    model.Add(daily_sum >= 1).OnlyEnforceIf(r)
                    model.Add(daily_sum == 0).OnlyEnforceIf(r.Not())
                else:
                    model.Add(r == 0)

                # Daily cap per event when r=1 (hours scale)
                if ev.labor_daily_cap is not None:
                    cap_scaled = int(round(ev.labor_daily_cap * TIME_SCALE_UNITS_PER_HOUR))
                    model.Add(daily_sum <= cap_scaled * r)

            # People requirement per active day: sum(assign) >= people_required
            if ev.people_required is not None and ev.people_required > 0:
                for t in sorted(allowed_days):
                    r = ctx.variables.r_event_by_e_t.get((ev.id, t))
                    if r is None:
                        # Should not happen because r was created above; be safe.
                        r = ctx.model.NewBoolVar(f"r_{ev.id}_{t}")
                        ctx.variables.r_event_by_e_t[(ev.id, t)] = r
                    assigns = [
                        ctx.variables.assign_by_w_e_t[(w.id, ev.id, t)]
                        for w in ctx.request.workers
                        if (w.blocked_days is None or t not in w.blocked_days)
                        and (w.id, ev.id, t) in ctx.variables.assign_by_w_e_t
                    ]
                    if assigns:
                        model.Add(
                            sum(assigns) >= int(ev.people_required)
                        ).OnlyEnforceIf(r)

            # Total need over horizon (integer linearization with q * Σh >= p * Σx)
            horizon_sum_terms: list[cp_model.LinearExpr] = []
            for t in sorted(allowed_days):
                for w in ctx.request.workers:
                    v = ctx.variables.h_time_by_w_e_t.get((w.id, ev.id, t))
                    if v is not None:
                        horizon_sum_terms.append(v)
            if horizon_sum_terms:
                # Exact total equality in scaled space
                model.Add(q * sum(horizon_sum_terms) == total_need_num_expr)

        # Worker per-day capacity across events
        for w in ctx.request.workers:
            cap = int(round((w.capacity_per_day or 0.0) * TIME_SCALE_UNITS_PER_HOUR))
            for t in range(1, H + 1):
                day_terms: list[cp_model.LinearExpr] = []
                for ev in ctx.request.events:
                    v = ctx.variables.h_time_by_w_e_t.get((w.id, ev.id, t))
                    if v is not None:
                        day_terms.append(v)
                if day_terms:
                    model.Add(sum(day_terms) <= cap)
