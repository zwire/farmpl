from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from typing import Literal

from schemas import ApiPlan
from schemas.metrics import (
    DayRecord,
    DaySummary,
    EventMetric,
    LandMetric,
    TimelineResponse,
    WorkerMetric,
)

from . import job_runner


def _decade_key(day: int) -> str:
    month_index = day // 30
    d_in_month = day % 30
    if d_in_month < 10:
        label = "U"
    elif d_in_month < 20:
        label = "M"
    else:
        label = "L"
    return f"{month_index:03d}:{label}"


def _validate_range(plan_days: int, start_day: int, end_day: int) -> None:
    if start_day < 0 or end_day < 0:
        raise ValueError("start_day and end_day must be non-negative")
    if end_day < start_day:
        raise ValueError("end_day must be >= start_day")
    if end_day >= plan_days:
        raise ValueError(f"end_day out of range (0..{plan_days - 1})")


def _iter_days(start_day: int, end_day: int) -> Iterable[int]:
    return range(start_day, end_day + 1)


def aggregate(
    job_id: str, start_day: int, end_day: int, bucket: Literal["day", "decade"]
) -> TimelineResponse:
    """Aggregate worker/land utilization per day or decade from a completed job.

    - Uses job_backend snapshot (no re-optimization)
    - Reads capacities from plan; usage from timeline spans/events
    """

    if bucket not in {"day", "decade"}:
        raise ValueError("bucket must be 'day' or 'decade'")

    snap = job_runner.snapshot(job_id)
    if snap.result is None or snap.req is None or snap.result.status != "ok":
        raise ValueError("job is not completed with status 'ok'")

    plan: ApiPlan = snap.req.plan  # type: ignore[assignment]
    if plan is None:
        raise ValueError("snapshot has no plan")

    plan_days = plan.horizon.num_days
    _validate_range(plan_days, start_day, end_day)

    # Lookups
    workers_by = {w.id: w for w in plan.workers}
    lands_by = {l.id: l for l in plan.lands}
    events_by = {e.id: e for e in plan.events}

    land_cap_by: dict[str, float] = {
        lid: l.normalized_area_a() for lid, l in lands_by.items()
    }

    # Accumulators
    labor_used_by_worker_day: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )
    labor_unassigned_by_day: dict[int, float] = defaultdict(float)
    land_used_by_land_day: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )

    timeline = snap.result.timeline
    if timeline is None:
        # No timeline; return empty records
        return TimelineResponse(interval=bucket, records=[])

    # Land utilization from spans (inclusive end_day)
    for span in timeline.land_spans:
        s = max(start_day, span.start_day)
        e = min(end_day, span.end_day)
        if e < s:
            continue
        for d in _iter_days(s, e):
            land_used_by_land_day[span.land_id][d] += float(span.area_a)

    # Labor utilization from events (single-day events)
    for ev in timeline.events:
        d = ev.day
        if d < start_day or d > end_day:
            continue
        meta = events_by.get(ev.event_id)
        if meta is None:
            continue
        area_a = 0.0
        for lid in ev.land_ids:
            land = lands_by.get(lid)
            if land is not None:
                area_a += land.normalized_area_a()
        labor_total_per_a = float(meta.labor_total_per_a or 0.0)
        labor_total = labor_total_per_a * area_a
        if ev.worker_ids:
            share = labor_total / float(len(ev.worker_ids)) if labor_total > 0 else 0.0
            for wid in ev.worker_ids:
                if wid in workers_by:
                    labor_used_by_worker_day[wid][d] += share
        else:
            labor_unassigned_by_day[d] += labor_total

    # Build records
    if bucket == "day":
        records: list[DayRecord] = []
        for d in _iter_days(start_day, end_day):
            # Workers
            worker_metrics: list[WorkerMetric] = []
            for wid, w in workers_by.items():
                used = float(labor_used_by_worker_day[wid][d])
                cap = float(w.capacity_per_day)
                worker_metrics.append(
                    WorkerMetric(
                        worker_id=wid, name=w.name, utilization=used, capacity=cap
                    )
                )

            # Lands
            land_metrics: list[LandMetric] = []
            for lid, l in lands_by.items():
                used = float(land_used_by_land_day[lid][d])
                cap = float(land_cap_by[lid])
                land_metrics.append(
                    LandMetric(land_id=lid, name=l.name, utilization=used, capacity=cap)
                )

            # Events on day d
            event_metrics: list[EventMetric] = []
            for ev in timeline.events:
                if ev.day == d:
                    meta = events_by.get(ev.event_id)
                    label = meta.name if meta is not None else ev.event_id
                    etype = meta.category if meta is not None else None
                    event_metrics.append(
                        EventMetric(
                            id=ev.event_id,
                            label=label,
                            start_day=d,
                            end_day=None,
                            type=etype,
                        )
                    )

            # Summary
            labor_total = sum(x.utilization for x in worker_metrics) + float(
                labor_unassigned_by_day[d]
            )
            labor_cap_total = sum(x.capacity for x in worker_metrics)
            land_total = sum(x.utilization for x in land_metrics)
            land_cap_total = sum(x.capacity for x in land_metrics)

            records.append(
                DayRecord(
                    interval="day",
                    day_index=d,
                    period_key=None,
                    events=event_metrics,
                    workers=worker_metrics,
                    lands=land_metrics,
                    summary=DaySummary(
                        labor_total_hours=labor_total,
                        labor_capacity_hours=labor_cap_total,
                        land_total_area=land_total,
                        land_capacity_area=land_cap_total,
                    ),
                )
            )
        return TimelineResponse(interval="day", records=records)

    # bucket == 'decade'
    # Group day indices
    groups: dict[str, list[int]] = defaultdict(list)
    for d in _iter_days(start_day, end_day):
        groups[_decade_key(d)].append(d)

    records: list[DayRecord] = []
    for key, days in groups.items():
        # Workers
        worker_metrics: list[WorkerMetric] = []
        for wid, w in workers_by.items():
            used = sum(float(labor_used_by_worker_day[wid][d]) for d in days)
            cap = float(w.capacity_per_day) * len(days)
            worker_metrics.append(
                WorkerMetric(worker_id=wid, name=w.name, utilization=used, capacity=cap)
            )

        # Lands
        land_metrics: list[LandMetric] = []
        for lid, l in lands_by.items():
            used = sum(float(land_used_by_land_day[lid][d]) for d in days)
            cap = float(land_cap_by[lid]) * len(days)
            land_metrics.append(
                LandMetric(land_id=lid, name=l.name, utilization=used, capacity=cap)
            )

        # Events in group
        event_metrics: list[EventMetric] = []
        for ev in timeline.events:
            if ev.day in days:
                meta = events_by.get(ev.event_id)
                label = meta.name if meta is not None else ev.event_id
                etype = meta.category if meta is not None else None
                event_metrics.append(
                    EventMetric(
                        id=ev.event_id,
                        label=label,
                        start_day=ev.day,
                        end_day=None,
                        type=etype,
                    )
                )

        # Summary
        labor_total = sum(float(labor_unassigned_by_day[d]) for d in days) + sum(
            x.utilization for x in worker_metrics
        )
        labor_cap_total = sum(x.capacity for x in worker_metrics)
        land_total = sum(x.utilization for x in land_metrics)
        land_cap_total = sum(x.capacity for x in land_metrics)

        records.append(
            DayRecord(
                interval="decade",
                day_index=None,
                period_key=key,
                events=event_metrics,
                workers=worker_metrics,
                lands=land_metrics,
                summary=DaySummary(
                    labor_total_hours=labor_total,
                    labor_capacity_hours=labor_cap_total,
                    land_total_area=land_total,
                    land_capacity_area=land_cap_total,
                ),
            )
        )

    return TimelineResponse(interval="decade", records=records)
