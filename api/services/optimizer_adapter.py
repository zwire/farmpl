from __future__ import annotations

import math
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from datetime import timedelta

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
from lib.thirds import period_key as third_period_key
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


def _compress_api_plan_to_third(api: ApiPlan) -> PlanRequest:
    """Compress an ApiPlan (day-indexed) into a third-indexed PlanRequest.

    Policy (coarse but fast):
    - Horizon: each calendar third becomes one time unit (1-based index).
    - Workers/Resources capacity_per_day: scaled by 10x (average days/third).
      Blocked thirds: if all days of the third are blocked, mark that third blocked.
    - Lands: area unchanged; blocked thirds only when fully blocked in original.
    - Events: start/end windows mapped to third indices; frequency/lag days -> ceil(/10).
      labor_total_per_area unchanged; labor_daily_cap scaled by 10x.
    """

    start = api.horizon.start_date
    num_days = int(api.horizon.num_days)
    # Build day -> third index mapping in chronological order
    third_keys: list[str] = []
    third_index_by_key: dict[str, int] = {}
    day_to_third_idx: list[int] = []  # 0-based day -> 1-based third index
    for d in range(num_days):
        dt = start + timedelta(days=d)
        key = third_period_key(dt)
        if not third_keys or third_keys[-1] != key:
            third_keys.append(key)
            third_index_by_key[key] = len(third_keys)
        day_to_third_idx.append(third_index_by_key[key])

    T = len(third_keys)

    # Helper to map a 0-based day set to third indices set (1-based)
    def map_days_set(days: set[int] | None) -> set[int] | None:
        if not days:
            return None
        out: set[int] = set()
        for day0 in days:
            if 0 <= day0 < num_days:
                out.add(day_to_third_idx[day0])
        return out

    # Count days per third and per-third fully-blocked markers per entity
    days_in_third: list[int] = [0] * (T + 1)  # 1..T
    for d in range(num_days):
        days_in_third[day_to_third_idx[d]] += 1

    def fully_blocked_thirds(blocked_days: set[int] | None) -> set[int] | None:
        if not blocked_days:
            return None
        blk = {int(x) for x in blocked_days}
        fb: set[int] = set()
        for t in range(1, T + 1):
            # all days of the third are blocked
            day_indices = [i for i in range(num_days) if day_to_third_idx[i] == t]
            if day_indices and all((i in blk) for i in day_indices):
                fb.add(t)
        return fb or None

    # Crops
    crops = [
        Crop(
            id=c.id,
            name=c.name,
            category=c.category,
            price_per_area=(
                c.normalized_price_per_a()
                if (c.price_per_a is not None) ^ (c.price_per_10a is not None)
                else None
            ),
        )
        for c in api.crops
    ]

    # Events (map windows and day-based params)
    events = []
    for e in api.events:
        start_set_th = map_days_set(e.start_cond)
        end_set_th = map_days_set(e.end_cond)
        freq_th = None
        if e.frequency_days and e.frequency_days > 0:
            freq_th = int(math.ceil(e.frequency_days / 10.0))
        lag_min_th = (
            int(math.ceil((e.lag_min_days or 0) / 10.0)) if e.lag_min_days else None
        )
        lag_max_th = (
            int(math.ceil((e.lag_max_days or 0) / 10.0)) if e.lag_max_days else None
        )
        events.append(
            Event(
                id=e.id,
                crop_id=e.crop_id,
                name=e.name,
                category=e.category,
                start_cond=start_set_th,
                end_cond=end_set_th,
                frequency_days=freq_th,
                preceding_event_id=e.preceding_event_id,
                lag_min_days=lag_min_th,
                lag_max_days=lag_max_th,
                people_required=e.people_required,
                labor_total_per_area=e.labor_total_per_a,
                labor_daily_cap=(
                    (e.labor_daily_cap * 10.0)
                    if e.labor_daily_cap is not None
                    else None
                ),
                required_roles=e.required_roles,
                required_resources=e.required_resources,
                uses_land=e.uses_land,
            )
        )

    # Lands
    lands = [
        Land(
            id=land.id,
            name=land.name,
            area=land.normalized_area_a(),
            tags=land.tags,
            blocked_days=fully_blocked_thirds(land.blocked_days),
        )
        for land in api.lands
    ]

    # Workers
    workers = []
    for w in api.workers:
        workers.append(
            Worker(
                id=w.id,
                name=w.name,
                roles=set(w.roles) if w.roles else set(),
                capacity_per_day=float(w.capacity_per_day) * 10.0,
                blocked_days=fully_blocked_thirds(w.blocked_days),
            )
        )

    # Resources
    resources = []
    for r in api.resources:
        resources.append(
            Resource(
                id=r.id,
                name=r.name,
                category=r.category,
                capacity_per_day=(float(r.capacity_per_day) * 10.0)
                if r.capacity_per_day
                else None,
                blocked_days=fully_blocked_thirds(r.blocked_days),
            )
        )

    # Bounds and fixed areas
    bounds = None
    if api.crop_area_bounds:
        bounds = []
        for b in api.crop_area_bounds:
            bounds.append(
                CropAreaBound(
                    crop_id=b.crop_id,
                    min_area=b.normalized_min_area(),
                    max_area=b.normalized_max_area(),
                )
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
        horizon=Horizon(num_days=T),
        crops=crops,
        events=events,
        lands=lands,
        workers=workers,
        resources=resources,
        crop_area_bounds=bounds,
        fixed_areas=fixed,
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
    for land_id, by_t in resp.assignment.crop_area_by_land_t.items():
        crop_ids: set[str] = set()
        for per_crop in by_t.values():
            crop_ids.update(per_crop.keys())
        for crop_id in sorted(crop_ids):
            times = sorted(t for t, per in by_t.items() if crop_id in per)
            if not times:
                continue
            # Detect t indexing of incoming assignment:
            # - If any t index is 0, treat as 0-based (no shift)
            # - Otherwise assume 1-based and shift down when emitting
            is_one_based = min(times) >= 1
            start = times[0]
            prev = start
            cur_area = by_t[start][crop_id]
            for d in times[1:]:
                a = by_t[d][crop_id]
                if d == prev + 1 and abs(a - cur_area) < 1e-9:
                    prev = d
                    continue
                spans.append(
                    GanttLandSpan(
                        land_id=land_id,
                        crop_id=crop_id,
                        start_index=start - 1 if is_one_based else start,
                        end_index=prev - 1 if is_one_based else prev,
                        area_a=float(cur_area),
                    )
                )
                start, prev, cur_area = d, d, a
            spans.append(
                GanttLandSpan(
                    land_id=land_id,
                    crop_id=crop_id,
                    start_index=start - 1 if is_one_based else start,
                    end_index=prev - 1 if is_one_based else prev,
                    area_a=float(cur_area),
                )
            )

    crop_by_event = {e.id: e.crop_id for e in req.events}
    event_meta_by_id = {e.id: e for e in req.events}
    land_by_id = {l.id: l for l in req.lands}
    event_names = {e.id: e.name for e in req.events}
    items: list[GanttEventItem] = []
    if resp.event_assignments:
        days_list = [ea.index for ea in resp.event_assignments]
        events_one_based = min(days_list) >= 1 if days_list else False
        # Precompute number of occurrences per event within provided assignments
        occ_count_by_event: dict[str, int] = {}
        for ea in resp.event_assignments:
            ev_id = ea.event_id
            occ_count_by_event[ev_id] = occ_count_by_event.get(ev_id, 0) + 1

        for ea in resp.event_assignments:
            index = ea.index - 1 if events_one_based else ea.index
            ev_meta = event_meta_by_id.get(ea.event_id)
            crop_id = crop_by_event.get(ea.event_id, "")
            # Estimate area for this occurrence if not provided explicitly
            if ea.crop_area_on_t is not None:
                area_a = float(ea.crop_area_on_t)
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
                    index=index,
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
    if req.plan is None:
        return OptimizationResult(
            status="error",
            objective_value=None,
            solution=None,
            stats={"message": "plan もしくは params を指定してください"},
            warnings=[],
        )

    # Convert to third-granularity domain plan
    domain_req = _compress_api_plan_to_third(req.plan)

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
