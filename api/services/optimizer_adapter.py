from __future__ import annotations

from collections.abc import Callable
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
    ResourceUsage,
    WorkerUsage,
)


def to_domain_plan(api: ApiPlan) -> PlanRequest:
    crops = []
    for c in api.crops:
        price = None
        if (c.price_per_a is not None) ^ (c.price_per_10a is not None):
            price = c.normalized_price_per_a()
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
        )
        for e in api.events
    ]

    lands = [
        Land(
            id=api_land.id,
            name=api_land.name,
            area=api_land.normalized_area_a(),
            tags=api_land.tags,
            blocked_days=api_land.blocked_days,
        )
        for api_land in api.lands
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
            min_area = b.normalized_min_area()
            max_area = b.normalized_max_area()
            bounds.append(
                CropAreaBound(crop_id=b.crop_id, min_area=min_area, max_area=max_area)
            )

    fixed = None
    if api.fixed_areas:
        fixed = [
            FixedArea(
                land_id=f.land_id,
                crop_id=f.crop_id,
                area=f.normalized_area_a(),
            )
            for f in api.fixed_areas
        ]

    return PlanRequest(
        horizon=Horizon(num_days=api.horizon.num_days),
        crops=crops,
        events=events,
        lands=lands,
        workers=workers,
        resources=resources,
        crop_area_bounds=bounds,
        fixed_areas=fixed,
    )


def _build_timeline(
    resp: PlanResponse, req: PlanRequest, *, start_date_iso: str | None = None
) -> OptimizationTimeline:
    spans: list[GanttLandSpan] = []
    for land_id, by_day in resp.assignment.crop_area_by_land_day.items():
        crop_ids: set[str] = set()
        for per_crop in by_day.values():
            crop_ids.update(per_crop.keys())
        for crop_id in sorted(crop_ids):
            days = sorted(d for d, per in by_day.items() if crop_id in per)
            if not days:
                continue
            # Detect day indexing of incoming assignment:
            # - If any day index is 0, treat as 0-based (no shift)
            # - Otherwise assume 1-based and shift down when emitting
            is_one_based = min(days) >= 1
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
                        start_day=start - 1 if is_one_based else start,
                        end_day=prev - 1 if is_one_based else prev,
                        area_a=float(cur_area),
                    )
                )
                start, prev, cur_area = d, d, a
            spans.append(
                GanttLandSpan(
                    land_id=land_id,
                    crop_id=crop_id,
                    start_day=start - 1 if is_one_based else start,
                    end_day=prev - 1 if is_one_based else prev,
                    area_a=float(cur_area),
                )
            )

    crop_by_event = {e.id: e.crop_id for e in req.events}
    event_meta_by_id = {e.id: e for e in req.events}
    land_by_id = {l.id: l for l in req.lands}
    event_names = {e.id: e.name for e in req.events}
    items: list[GanttEventItem] = []
    if resp.event_assignments:
        days_list = [ea.day for ea in resp.event_assignments]
        events_one_based = min(days_list) >= 1 if days_list else False
        # Precompute number of occurrences per event within provided assignments
        occ_count_by_event: dict[str, int] = {}
        for ea in resp.event_assignments:
            ev_id = ea.event_id
            occ_count_by_event[ev_id] = occ_count_by_event.get(ev_id, 0) + 1

        for ea in resp.event_assignments:
            day0 = ea.day - 1 if events_one_based else ea.day
            ev_meta = event_meta_by_id.get(ea.event_id)
            crop_id = crop_by_event.get(ea.event_id, "")
            # Estimate area for this occurrence if not provided explicitly
            if ea.crop_area_on_day is not None:
                area_a = float(ea.crop_area_on_day)
            else:
                area_a = 0.0
                for lid in ea.land_ids or []:
                    land = land_by_id.get(lid)
                    if land is not None:
                        area_a += land.normalized_area_a()
            labor_total_per_a = float(ev_meta.labor_total_per_area or 0.0)
            total_need = labor_total_per_a * area_a
            occ_cnt = max(1, occ_count_by_event.get(ea.event_id, 1))
            labor_for_day = total_need / float(occ_cnt)

            # Prefer actual per-worker hours if provided by planner; otherwise equal split
            worker_usages: list[WorkerUsage] = []
            assigned = list(ea.assigned_workers or [])
            if assigned:
                if any(w.used_time_hours for w in assigned):
                    worker_usages = [
                        WorkerUsage(
                            worker_id=w.id,
                            hours=float(w.used_time_hours or 0.0),
                        )
                        for w in assigned
                    ]
                else:
                    share = (
                        labor_for_day / float(len(assigned))
                        if labor_for_day > 0
                        else 0.0
                    )
                    worker_usages = [
                        WorkerUsage(worker_id=w.id, hours=share) for w in assigned
                    ]

            resource_usages = [
                ResourceUsage(
                    resource_id=ru.id, quantity=ru.used_time_hours, unit="hours"
                )
                for ru in (ea.resource_usage or [])
            ]

            items.append(
                GanttEventItem(
                    day=day0,
                    event_id=ea.event_id,
                    crop_id=crop_id,
                    land_ids=list(ea.land_ids or []),
                    worker_usages=worker_usages,
                    resource_usages=resource_usages,
                    event_name=event_names.get(ea.event_id),
                )
            )
    # 名前マップを組み立て
    land_names = {land.id: land.name for land in req.lands}
    crop_names = {crop.id: crop.name for crop in req.crops}
    worker_names = {worker.id: worker.name for worker in req.workers}
    resource_names = {res.id: res.name for res in req.resources}

    return OptimizationTimeline(
        land_spans=spans,
        events=items,
        entity_names={
            "lands": land_names,
            "crops": crop_names,
            "workers": worker_names,
            "resources": resource_names,
            "events": event_names,
        },
        start_date=start_date_iso,
    )


def solve_sync(
    req: OptimizationRequest, progress_cb: Callable[[float, str], None] | None = None
) -> OptimizationResult:
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
        progress_cb=progress_cb,
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
    if progress_cb:
        progress_cb(0.95, "post:timeline_build")
    # Pass through plan.horizon.start_date (if provided on API) to timeline.start_date
    start_date_iso = None
    try:
        if (
            req.plan
            and req.plan.horizon
            and getattr(req.plan.horizon, "start_date", None)
        ):
            start_date_iso = str(req.plan.horizon.start_date)
    except Exception:
        start_date_iso = None
    result.timeline = _build_timeline(resp, domain_req, start_date_iso=start_date_iso)
    if progress_cb:
        progress_cb(1.0, "done")
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
