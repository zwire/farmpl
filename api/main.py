from __future__ import annotations

import argparse
import json
from typing import Any

from demo.compare import compare_objectives, run_planner
from demo.print_utils import color, print_table
from demo.sample import build_sample_request
from lib.schemas import PlanResponse


def _print_objectives_and_summary(result: PlanResponse) -> None:
    if result.objectives:
        rows = ([k, f"{v:.3f}"] for k, v in result.objectives.items())
        print_table(["objective", "value"], rows)
    if result.summary:
        rows = ([k, f"{v:.3f}"] for k, v in result.summary.items())
        print_table(["metric", "value"], rows)
    if result.constraint_hints:
        print(color("Hints:", kind="warn"))
        for h in result.constraint_hints:
            print(" -", h)


def _print_plan(result: PlanResponse) -> None:
    diag = result.diagnostics
    print(color(f"feasible: {diag.feasible}", kind="ok" if diag.feasible else "err"))
    # Print stage summary if present
    if getattr(diag, "stages", None):
        order = getattr(diag, "stage_order", None) or [
            s.get("name") for s in diag.stages
        ]
        tol_pct = getattr(diag, "lock_tolerance_pct", 0.0) or 0.0
        print("Stages:", ", ".join(order), f"(lock-tol={tol_pct * 100:.1f}%)")
        tol_by = getattr(diag, "lock_tolerance_by", None)
        if tol_by:
            pairs = ", ".join(f"{k}={v:.1f}%" for k, v in tol_by.items())
            print("Per-stage tol:", pairs)
        rows = (
            [s.get("name"), s.get("sense"), str(int(s.get("value", 0)))]
            for s in diag.stages
        )
        print_table(["stage", "sense", "value"], rows)
    # Areas table
    area_rows: list[list[str]] = []
    for land_id, by_day in sorted(
        (result.assignment.crop_area_by_land_day or {}).items()
    ):
        for t in sorted(by_day.keys()):
            crops = ",".join(f"{c}:{a:.1f}" for c, a in by_day[t].items())
            area_rows.append([land_id, str(t), crops])
    if area_rows:
        print_table(["land", "day", "area(crop:amount)"], area_rows)
    if result.assignment.idle_by_land_day:
        idle_rows: list[list[str]] = []
        for land_id, by_day in result.assignment.idle_by_land_day.items():
            for t in sorted(by_day.keys()):
                idle_rows.append([land_id, str(t), f"{by_day[t]:.1f}"])
        print_table(["land", "day", "idle"], idle_rows)
    if result.event_assignments:
        ev_rows: list[list[str]] = []
        for ea in sorted(result.event_assignments, key=lambda x: (x.day, x.event_id)):
            workers = ",".join(w.name for w in ea.assigned_workers)
            resources = ",".join(
                f"{r.name}:{r.used_time_hours:.1f}" for r in ea.resource_usage
            )
            ev_rows.append(
                [
                    str(ea.day),
                    ea.event_id,
                    workers,
                    resources,
                    f"{(ea.crop_area_on_day or 0):.1f}",
                ]
            )
        print_table(["day", "event", "workers", "resources", "crop_area"], ev_rows)

    _print_objectives_and_summary(result)


def main() -> None:
    parser = argparse.ArgumentParser(description="FarmPL demo CLI")
    sub = parser.add_subparsers(dest="cmd")
    p_plan = sub.add_parser("plan", help="Run lexicographic planner on sample data")
    p_plan.add_argument("--json", action="store_true", help="Reserved")
    p_plan.add_argument(
        "--extra",
        action="append",
        default=[],
        help='Add extra lexicographic stages after profit->dispersion (e.g. "labor")',
    )
    p_plan.add_argument(
        "--stages",
        type=str,
        default=None,
        help='Comma-separated stage order to fully control priority (e.g. "profit,dispersion,labor")',
    )
    p_plan.add_argument(
        "--lock-tol",
        type=float,
        default=0.0,
        help="Tolerance percent for locking previous stages (e.g. 2.0 = allow 2% degradation)",
    )
    p_plan.add_argument(
        "--lock-tol-by",
        type=str,
        default=None,
        help='Per-stage tolerance percent, e.g. "profit=2,dispersion=5"',
    )
    p_cmp = sub.add_parser(
        "compare", help="Compare lexicographic stage setups on sample data"
    )
    p_cmp.add_argument("--json", action="store_true", help="Output JSON only")
    p_cmp.add_argument(
        "--stages",
        type=str,
        default=None,
        help='Comma-separated stage order to run as custom scenario (e.g. "profit,diversity,dispersion")',
    )
    p_cmp.add_argument(
        "--lock-tol",
        type=float,
        default=0.0,
        help="Tolerance percent for locking previous stages (applies only to --stages custom run)",
    )
    p_cmp.add_argument(
        "--lock-tol-by",
        type=str,
        default=None,
        help='Per-stage tolerance percent for custom compare, e.g. "profit=2,dispersion=5"',
    )

    args = parser.parse_args()

    # Default to 'plan' to keep backward compatibility
    cmd = args.cmd or "plan"
    req = build_sample_request()

    if cmd == "plan":
        extras = list(getattr(args, "extra", []) or [])
        stage_order = None
        if getattr(args, "stages", None):
            stage_order = [s.strip() for s in str(args.stages).split(",") if s.strip()]
        tol_pct = float(getattr(args, "lock_tol", 0.0) or 0.0) / 100.0
        tol_by_raw = getattr(args, "lock_tol_by", None)
        tol_by_map: dict[str, float] | None = None
        if tol_by_raw:
            tol_by_map = {}
            for part in str(tol_by_raw).split(","):
                if "=" in part:
                    k, v = part.split("=", 1)
                    try:
                        tol_by_map[k.strip()] = float(v.strip()) / 100.0
                    except ValueError:
                        pass
        result = run_planner(
            req,
            extra_stages=extras if not stage_order else None,
            stage_order=stage_order,
            lock_tolerance_pct=tol_pct,
            lock_tolerance_by=tol_by_map,
        )
        _print_plan(result)
        return

    if cmd == "compare":
        stage_order = None
        if getattr(args, "stages", None):
            stage_order = [s.strip() for s in str(args.stages).split(",") if s.strip()]
        tol_by_raw = getattr(args, "lock_tol_by", None)
        tol_by_map2: dict[str, float] | None = None
        if tol_by_raw:
            tol_by_map2 = {}
            for part in str(tol_by_raw).split(","):
                if "=" in part:
                    k, v = part.split("=", 1)
                    try:
                        tol_by_map2[k.strip()] = float(v.strip())
                    except ValueError:
                        pass
        out: dict[str, Any] = compare_objectives(
            req,
            stage_order=stage_order,
            lock_tolerance_pct=float(getattr(args, "lock_tol", 0.0) or 0.0),
            lock_tolerance_by=tol_by_map2,
        )
        if getattr(args, "json", False):
            print(json.dumps(out, ensure_ascii=False))
        else:
            print("\n--- Objective comparison ---")
            for name, data in out.items():
                print(name + ":")
                # When custom, data is a dict of stages
                if isinstance(data, dict) and all(
                    isinstance(v, dict) for v in data.values()
                ):
                    print(
                        f"{'stage':12} {'status':8} {'value':>8} {'labor(h)':>10} {'areas':>12}"
                    )
                    for st, d in data.items():
                        areas = d.get("crop_base_areas") or {}
                        areas_str = ";".join(
                            f"{k}:{v:.1f}" for k, v in list(areas.items())[:3]
                        )
                        print(
                            f"{st:12} {d.get('status', ''):8} {int(d.get('value', 0)):>8} {int(d.get('total_labor_hours', 0)):>10} {areas_str:>12}"
                        )
                else:
                    print(data)

            # Also print PlanResponse-style objectives/summary for the selected scenario
            if stage_order:
                tol_frac = float(getattr(args, "lock_tol", 0.0) or 0.0) / 100.0
                tol_by_frac = None
                if tol_by_map2:
                    tol_by_frac = {k: v / 100.0 for k, v in tol_by_map2.items()}
                pr = run_planner(
                    req,
                    stage_order=stage_order,
                    lock_tolerance_pct=tol_frac,
                    lock_tolerance_by=tol_by_frac,
                )
                print(color("\nObjectives & Summary (custom)", kind="title"))
                _print_objectives_and_summary(pr)
            else:
                pr = run_planner(req)
                print(color("\nObjectives & Summary (two_stage)", kind="title"))
                _print_objectives_and_summary(pr)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
