from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout

from lib.planner import plan as run_plan
from lib.schemas import (
    Crop,
    CropAreaBound,
    Event,
    FixedArea,
    Horizon,
    Land,
    PlanRequest,
    PlanResponse,
    Preferences,
    Resource,
    Worker,
)
from schemas.optimization import (
    ApiPlan,
    GanttEventItem,
    GanttLandSpan,
    OptimizationRequest,
    OptimizationResult,
    OptimizationTimeline,
)


def _area_from_units(area_a: float | None, area_10a: float | None) -> float:
    if (area_a is None) == (area_10a is None):
        raise ValueError("area_a と area_10a はどちらか一方のみ指定してください")
    return float(area_a) if area_a is not None else float(area_10a) * 10.0


def _price_per_a(price_per_a: float | None, price_per_10a: float | None) -> float:
    if (price_per_a is None) == (price_per_10a is None):
        raise ValueError(
            "price_per_a と price_per_10a はどちらか一方のみ指定してください"
        )
    return (
        float(price_per_a) if price_per_a is not None else float(price_per_10a) / 10.0
    )


def to_domain_plan(api: ApiPlan) -> PlanRequest:
    crops = []
    for c in api.crops:
        price = None
        if (c.price_per_a is not None) ^ (c.price_per_10a is not None):
            price = _price_per_a(c.price_per_a, c.price_per_10a)
        crops.append(
            Crop(
                id=c.id,
                name=c.name,
                category=c.category,
                price_per_area=price,
            )
        )

    events = [
        Event(
            id=e.id,
            crop_id=e.crop_id,
            name=e.name,
            category=e.category,
            start_cond=e.start_cond,
            end_cond=e.end_cond,
            frequency_days=e.frequency_days,
            preceding_event_id=e.preceding_event_id,
            lag_min_days=e.lag_min_days,
            lag_max_days=e.lag_max_days,
            people_required=e.people_required,
            labor_total_per_area=e.labor_total_per_a,
            labor_daily_cap=e.labor_daily_cap,
            required_roles=e.required_roles,
            required_resources=e.required_resources,
            uses_land=e.uses_land,
            occupancy_effect=e.occupancy_effect,
        )
        for e in api.events
    ]

    lands = [
        Land(
            id=l.id,
            name=l.name,
            area=_area_from_units(l.area_a, l.area_10a),
            tags=l.tags,
            blocked_days=l.blocked_days,
        )
        for l in api.lands
    ]

    workers = [
        Worker(
            id=w.id,
            name=w.name,
            roles=set(w.roles) if w.roles else set(),
            capacity_per_day=w.capacity_per_day,
            blocked_days=w.blocked_days,
        )
        for w in api.workers
    ]

    resources = [
        Resource(
            id=r.id,
            name=r.name,
            category=r.category,
            capacity_per_day=r.capacity_per_day,
            blocked_days=r.blocked_days,
        )
        for r in api.resources
    ]

    bounds = None
    if api.crop_area_bounds:
        bounds = []
        for b in api.crop_area_bounds:
            min_area = None
            max_area = None
            if b.min_area_a is not None or b.min_area_10a is not None:
                min_area = (
                    b.min_area_a
                    if b.min_area_a is not None
                    else (b.min_area_10a or 0) * 10.0
                )
            if b.max_area_a is not None or b.max_area_10a is not None:
                max_area = (
                    b.max_area_a
                    if b.max_area_a is not None
                    else (b.max_area_10a or 0) * 10.0
                )
            bounds.append(
                CropAreaBound(crop_id=b.crop_id, min_area=min_area, max_area=max_area)
            )

    fixed = None
    if api.fixed_areas:
        fixed = [
            FixedArea(
                land_id=f.land_id,
                crop_id=f.crop_id,
                area=_area_from_units(f.area_a, f.area_10a),
            )
            for f in api.fixed_areas
        ]

    prefs = None
    if api.preferences is not None:
        p = api.preferences
        prefs = Preferences(
            w_profit=p.w_profit,
            w_labor=p.w_labor,
            w_idle=p.w_idle,
            w_dispersion=p.w_dispersion,
            w_peak=p.w_peak,
            w_diversity=p.w_diversity,
        )

    return PlanRequest(
        horizon=Horizon(num_days=api.horizon.num_days),
        crops=crops,
        events=events,
        lands=lands,
        workers=workers,
        resources=resources,
        crop_area_bounds=bounds,
        fixed_areas=fixed,
        preferences=prefs,
    )


def _build_timeline(resp: PlanResponse, req: PlanRequest) -> OptimizationTimeline:
    spans: list[GanttLandSpan] = []
    for land_id, by_day in resp.assignment.crop_area_by_land_day.items():
        crop_ids: set[str] = set()
        for per_crop in by_day.values():
            crop_ids.update(per_crop.keys())
        for crop_id in sorted(crop_ids):
            days = sorted(d for d, per in by_day.items() if crop_id in per)
            if not days:
                continue
            start = days[0]
            prev = start
            cur_area = by_day[start][crop_id]
            for d in days[1:]:
                a = by_day[d][crop_id]
                if d == prev + 1 and abs(a - cur_area) < 1e-9:
                    prev = d
                    continue
                spans.append(
                    GanttLandSpan(
                        land_id=land_id,
                        crop_id=crop_id,
                        start_day=start,
                        end_day=prev,
                        area_a=float(cur_area),
                    )
                )
                start, prev, cur_area = d, d, a
            spans.append(
                GanttLandSpan(
                    land_id=land_id,
                    crop_id=crop_id,
                    start_day=start,
                    end_day=prev,
                    area_a=float(cur_area),
                )
            )

    crop_by_event = {e.id: e.crop_id for e in req.events}
    items: list[GanttEventItem] = []
    if resp.event_assignments:
        for ea in resp.event_assignments:
            items.append(
                GanttEventItem(
                    day=ea.day,
                    event_id=ea.event_id,
                    crop_id=crop_by_event.get(ea.event_id, ""),
                    land_id=None,
                    worker_ids=[w.id for w in (ea.assigned_workers or [])],
                    resource_ids=[ru.id for ru in (ea.resource_usage or [])],
                )
            )
    return OptimizationTimeline(land_spans=spans, events=items)


def solve_sync(req: OptimizationRequest) -> OptimizationResult:
    if req.plan is None and (req.params is None or req.params == {}):
        return OptimizationResult(
            status="error",
            objective_value=None,
            solution=None,
            stats={"message": "plan もしくは params を指定してください"},
            warnings=[],
        )

    if req.plan is None:
        return OptimizationResult(
            status="error",
            objective_value=None,
            solution=None,
            stats={"message": "params 形式は未サポートです。plan で送信してください。"},
            warnings=[],
        )

    domain_req = to_domain_plan(req.plan)

    stage_order = None
    lock_by = None
    if req.plan.stages is not None:
        stage_order = req.plan.stages.stage_order
        lock_by = req.plan.stages.step_tolerance_by

    resp = run_plan(
        domain_req,
        extra_stages=None,
        stage_order=stage_order,
        lock_tolerance_pct=None,
        lock_tolerance_by=lock_by,
    )

    status = "ok" if resp.diagnostics.feasible else "infeasible"
    result = OptimizationResult(
        status=status,
        objective_value=resp.objectives.get("profit") if resp.objectives else None,
        solution={"summary": resp.summary, "constraint_hints": resp.constraint_hints},
        stats={
            "stages": resp.diagnostics.stages,
            "stage_order": resp.diagnostics.stage_order,
        },
        warnings=[],
    )
    result.timeline = _build_timeline(resp, domain_req)
    return result


def solve_sync_with_timeout(
    req: OptimizationRequest, timeout_ms: int | None
) -> OptimizationResult:
    if not timeout_ms or timeout_ms <= 0:
        return solve_sync(req)
    timeout_s = timeout_ms / 1000.0
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="sync-solver") as ex:
        fut = ex.submit(solve_sync, req)
        try:
            return fut.result(timeout=timeout_s)
        except FuturesTimeout:
            return OptimizationResult(
                status="timeout",
                objective_value=None,
                solution=None,
                stats={"timeout_ms": timeout_ms},
                warnings=["sync solve timed out"],
            )
