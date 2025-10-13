from __future__ import annotations

import time
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .model_builder import BuildContext


@dataclass
class SolveContext:
    build: BuildContext
    # In full impl, this may include solver status, objective value, etc.
    status: str = "UNKNOWN"
    objective_value: float | None = None
    x_area_by_l_c_t_values: dict[tuple[str, str, int], int] | None = None
    z_use_by_l_c_values: dict[tuple[str, str], int] | None = None
    r_event_by_e_t_values: dict[tuple[str, int], int] | None = None
    h_time_by_w_e_t_values: dict[tuple[str, str, int], int] | None = None
    assign_by_w_e_t_values: dict[tuple[str, str, int], int] | None = None
    u_time_by_r_e_t_values: dict[tuple[str, str, int], int] | None = None
    occ_by_c_t_values: dict[tuple[str, int], int] | None = None
    occ_by_l_c_t_values: dict[tuple[str, str, int], int] | None = None
    # timings
    solve_ms: float | None = None


def solve(ctx: BuildContext, prev: SolveContext | None = None) -> SolveContext:
    solver = cp_model.CpSolver()
    # Configure from env if available
    try:
        from core import config as _cfg

        mt = _cfg.sync_timeout_ms()
        nw = getattr(_cfg, "cp_num_workers", lambda: 0)()
    except Exception:
        mt = 5000
        nw = 0
    solver.parameters.max_time_in_seconds = max(0.1, (mt or 5000) / 1000.0)
    if isinstance(nw, int) and nw >= 0:
        solver.parameters.num_search_workers = nw

    # Warm start with hints from previous solution
    if prev is not None:
        # Per-day areas
        if prev.x_area_by_l_c_t_values is not None:
            for key, var in ctx.variables.x_area_by_l_c_t.items():
                if key in prev.x_area_by_l_c_t_values:
                    try:
                        ctx.model.AddHint(var, int(prev.x_area_by_l_c_t_values[key]))
                    except AttributeError:
                        pass
        # Use flags
        if prev.z_use_by_l_c_values is not None:
            for key, var in ctx.variables.z_use_by_l_c.items():
                if key in prev.z_use_by_l_c_values:
                    try:
                        ctx.model.AddHint(var, int(prev.z_use_by_l_c_values[key]))
                    except AttributeError:
                        pass
        # Event actives
        if prev.r_event_by_e_t_values is not None:
            for key, var in ctx.variables.r_event_by_e_t.items():
                if key in prev.r_event_by_e_t_values:
                    try:
                        ctx.model.AddHint(var, int(prev.r_event_by_e_t_values[key]))
                    except AttributeError:
                        pass

    t0 = time.perf_counter()
    status = solver.Solve(ctx.model)
    t1 = time.perf_counter()

    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }

    sc = SolveContext(build=ctx, status=status_map.get(status, "UNKNOWN"))
    sc.solve_ms = (t1 - t0) * 1000.0
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        sc.objective_value = solver.ObjectiveValue()
        # Extract variable values
        xa_lct: dict[tuple[str, str, int], int] = {}
        za: dict[tuple[str, str], int] = {}
        rvals: dict[tuple[str, int], int] = {}
        hvals: dict[tuple[str, str, int], int] = {}
        avals: dict[tuple[str, str, int], int] = {}
        uvals: dict[tuple[str, str, int], int] = {}
        occvals: dict[tuple[str, int], int] = {}
        occ_land_vals: dict[tuple[str, str, int], int] = {}
        for key, var in ctx.variables.x_area_by_l_c_t.items():
            xa_lct[key] = int(solver.Value(var))
        for key, var in ctx.variables.z_use_by_l_c.items():
            za[key] = int(solver.Value(var))
        for key, var in ctx.variables.r_event_by_e_t.items():
            rvals[key] = int(solver.Value(var))
        for key, var in ctx.variables.h_time_by_w_e_t.items():
            hvals[key] = int(solver.Value(var))
        for key, var in ctx.variables.assign_by_w_e_t.items():
            avals[key] = int(solver.Value(var))
        for key, var in ctx.variables.u_time_by_r_e_t.items():
            # resource time values
            aval = int(solver.Value(var))
            uvals[key] = aval
        for key, var in ctx.variables.occ_by_c_t.items():
            occvals[key] = int(solver.Value(var))
        for key, var in ctx.variables.occ_by_l_c_t.items():
            occ_land_vals[key] = int(solver.Value(var))
        sc.x_area_by_l_c_t_values = xa_lct
        sc.z_use_by_l_c_values = za
        sc.r_event_by_e_t_values = rvals
        sc.h_time_by_w_e_t_values = hvals
        sc.assign_by_w_e_t_values = avals
        sc.u_time_by_r_e_t_values = uvals
        sc.occ_by_c_t_values = occvals
        sc.occ_by_l_c_t_values = occ_land_vals
    return sc
