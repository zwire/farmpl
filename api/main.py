from __future__ import annotations

import argparse
import json
from typing import Any

from demo.compare import compare_objectives, run_planner
from demo.sample import build_sample_request
from lib.schemas import PlanResponse


def _print_plan(result: PlanResponse) -> None:
    print({"planner_feasible": result.diagnostics.feasible})
    for land_id, by_day in (result.assignment.crop_area_by_land_day or {}).items():
        for t in sorted(by_day.keys()):
            print({"land": land_id, "day": t, "area": by_day[t]})
    if result.assignment.idle_by_land_day:
        print("Idle:")
        for land_id, by_day in result.assignment.idle_by_land_day.items():
            for t in sorted(by_day.keys()):
                print({"land": land_id, "day": t, "idle": by_day[t]})
    if result.event_assignments:
        print("Event assignments:")
        for ea in sorted(result.event_assignments, key=lambda x: (x.day, x.event_id)):
            print(
                {
                    "day": ea.day,
                    "event": ea.event_id,
                    "assigned_workers": [
                        {"id": w.id, "name": w.name, "roles": w.roles}
                        for w in ea.assigned_workers
                    ],
                    "resources": [
                        {
                            "id": r.id,
                            "name": r.name,
                            "used_time_hours": r.used_time_hours,
                        }
                        for r in ea.resource_usage
                    ],
                    "crop_area_on_day": ea.crop_area_on_day,
                }
            )


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
    p_cmp = sub.add_parser("compare", help="Compare Profit vs Labor-min on sample data")
    p_cmp.add_argument("--json", action="store_true", help="Output JSON only")

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
        result = run_planner(
            req,
            extra_stages=extras if not stage_order else None,
            stage_order=stage_order,
            lock_tolerance_pct=tol_pct,
        )
        _print_plan(result)
        return

    if cmd == "compare":
        out: dict[str, Any] = compare_objectives(req)
        if getattr(args, "json", False):
            print(json.dumps(out, ensure_ascii=False))
        else:
            print("\n--- Objective comparison ---")
            for k, v in out.items():
                print(f"{k}: {v}")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
