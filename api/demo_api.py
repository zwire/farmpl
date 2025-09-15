from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any

from demo.sample import build_sample_request
from lib.schemas import PlanRequest


def _api_base() -> str:
    return os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def _headers(api_key: str | None = None, bearer: str | None = None) -> dict[str, str]:
    hdrs = {"Content-Type": "application/json"}
    if api_key:
        hdrs["X-API-Key"] = api_key
    if bearer:
        hdrs["Authorization"] = f"Bearer {bearer}"
    return hdrs


def _req(
    url: str, data: dict[str, Any] | None, headers: dict[str, str]
) -> dict[str, Any]:
    body = (
        None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    )
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            txt = resp.read().decode(charset)
            return json.loads(txt)
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            raise


def _plan_to_api(plan: PlanRequest) -> dict[str, Any]:
    def crop(c) -> dict[str, Any]:
        d = {"id": c.id, "name": c.name}
        if getattr(c, "category", None):
            d["category"] = c.category
        if getattr(c, "price_per_area", None) is not None:
            d["price_per_a"] = float(c.price_per_area)
        return d

    def event(e) -> dict[str, Any]:
        d = {
            "id": e.id,
            "crop_id": e.crop_id,
            "name": e.name,
            "start_cond": sorted(e.start_cond or []),
            "end_cond": sorted(e.end_cond or []),
            "uses_land": bool(getattr(e, "uses_land", False)),
        }
        for k in (
            "category",
            "frequency_days",
            "preceding_event_id",
            "lag_min_days",
            "lag_max_days",
            "people_required",
            "labor_total_per_area",
            "labor_daily_cap",
            "occupancy_effect",
        ):
            v = getattr(e, k, None)
            if v is not None:
                d[k if k != "labor_total_per_area" else "labor_total_per_a"] = v
        if getattr(e, "required_roles", None):
            d["required_roles"] = sorted(e.required_roles)
        if getattr(e, "required_resources", None):
            d["required_resources"] = sorted(e.required_resources)
        return d

    def land(l) -> dict[str, Any]:
        d = {
            "id": l.id,
            "name": l.name,
            "area_a": float(l.area),
        }
        if getattr(l, "tags", None):
            d["tags"] = sorted(l.tags)
        if getattr(l, "blocked_days", None):
            d["blocked_days"] = sorted(l.blocked_days)
        return d

    def worker(w) -> dict[str, Any]:
        return {
            "id": w.id,
            "name": w.name,
            "roles": sorted(w.roles or []),
            "capacity_per_day": float(w.capacity_per_day),
            "blocked_days": sorted(w.blocked_days or []),
        }

    def resource(r) -> dict[str, Any]:
        return {
            "id": r.id,
            "name": r.name,
            "category": getattr(r, "category", None),
            "capacity_per_day": r.capacity_per_day,
            "blocked_days": sorted(r.blocked_days or []),
        }

    api_plan: dict[str, Any] = {
        "horizon": {"num_days": plan.horizon.num_days},
        "crops": [crop(c) for c in plan.crops],
        "events": [event(e) for e in plan.events],
        "lands": [land(l) for l in plan.lands],
        "workers": [worker(w) for w in plan.workers],
        "resources": [resource(r) for r in plan.resources],
    }
    if plan.fixed_areas:
        api_plan["fixed_areas"] = [
            {"land_id": f.land_id, "crop_id": f.crop_id, "area_a": float(f.area)}
            for f in plan.fixed_areas
        ]
    if plan.crop_area_bounds:
        api_plan["crop_area_bounds"] = [
            {
                "crop_id": b.crop_id,
                **({"min_area_a": float(b.min_area)} if b.min_area is not None else {}),
                **({"max_area_a": float(b.max_area)} if b.max_area is not None else {}),
            }
            for b in plan.crop_area_bounds
        ]
    if plan.preferences:
        p = plan.preferences
        api_plan["preferences"] = {
            "w_profit": p.w_profit,
            "w_labor": p.w_labor,
            "w_idle": p.w_idle,
            "w_dispersion": p.w_dispersion,
            "w_peak": p.w_peak,
            "w_diversity": p.w_diversity,
        }
    return api_plan


def do_sync(api_key: str | None, bearer: str | None, as_json: bool) -> None:
    base = _api_base()
    pr = build_sample_request()
    api_plan = _plan_to_api(pr)
    payload = {"plan": api_plan}
    data = _req(f"{base}/v1/optimize", payload, _headers(api_key, bearer))
    if as_json:
        print(json.dumps(data, ensure_ascii=False))
        return
    status = data.get("status")
    print("status:", status)
    if status != "ok":
        print("error:", data.get("title"), data.get("detail"), data.get("errors"))
        return
    stats = data.get("stats", {})
    if stats:
        print("stats:", json.dumps(stats, ensure_ascii=False))
    if data.get("objective_value") is not None:
        print("objective_value:", data.get("objective_value"))


def do_async(
    api_key: str | None, bearer: str | None, as_json: bool, poll_s: float
) -> None:
    base = _api_base()
    pr = build_sample_request()
    api_plan = _plan_to_api(pr)
    payload = {"plan": api_plan}
    job = _req(f"{base}/v1/optimize/async", payload, _headers(api_key, bearer))
    job_id = job.get("job_id")
    if not job_id:
        print("failed to create job:", job)
        return
    while True:
        time.sleep(poll_s)
        cur = _req(f"{base}/v1/jobs/{job_id}", None, _headers(api_key, bearer))
        st = cur.get("status")
        if st in ("succeeded", "failed", "timeout", "canceled"):
            if as_json:
                print(json.dumps(cur, ensure_ascii=False))
            else:
                print("job status:", st)
                res = cur.get("result") or {}
                print("result status:", res.get("status"))
                if res.get("objective_value") is not None:
                    print("objective_value:", res.get("objective_value"))
            break


def main() -> None:
    parser = argparse.ArgumentParser(description="FarmPL API demo CLI")
    parser.add_argument(
        "--base",
        dest="base",
        default=_api_base(),
        help="API base URL (default env API_BASE_URL or http://127.0.0.1:8000)",
    )
    parser.add_argument("--api-key", dest="api_key", default=os.getenv("API_KEY"))
    parser.add_argument("--bearer", dest="bearer", default=os.getenv("BEARER_TOKEN"))
    sub = parser.add_subparsers(dest="cmd")
    p_sync = sub.add_parser("sync", help="Call POST /v1/optimize with sample plan")
    p_sync.add_argument("--json", action="store_true")
    p_async = sub.add_parser(
        "async", help="Call async endpoints with sample plan and poll"
    )
    p_async.add_argument("--json", action="store_true")
    p_async.add_argument(
        "--poll", type=float, default=0.2, help="Polling interval seconds"
    )

    args = parser.parse_args()
    if getattr(args, "base", None):
        os.environ["API_BASE_URL"] = str(args.base)

    if args.cmd in (None, "sync"):
        do_sync(args.api_key, args.bearer, bool(getattr(args, "json", False)))
        return
    if args.cmd == "async":
        do_async(
            args.api_key,
            args.bearer,
            bool(getattr(args, "json", False)),
            float(getattr(args, "poll", 0.2)),
        )
        return
    parser.print_help()


if __name__ == "__main__":
    main()
