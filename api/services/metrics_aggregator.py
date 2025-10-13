from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, timedelta
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


def _third_key(day: int, base_date: date) -> str:
    d = base_date + timedelta(days=day)
    year = d.year
    month = d.month
    dom = d.day
    if dom <= 10:
        label = "上旬"
    elif dom <= 20:
        label = "中旬"
    else:
        label = "下旬"
    return f"{year:04d}-{month:02d}:{label}"


def _iter_days(start_day: int, end_day: int) -> Iterable[int]:
    return range(start_day, end_day + 1)


def aggregate(
    job_id: str,
    bucket: Literal["day", "third"],
    *,
    base_date_iso: str | None = None,
) -> TimelineResponse:
    """Aggregate worker/land utilization per day or decade from a completed job.

    - Uses job_backend snapshot (no re-optimization)
    - Reads capacities from plan; usage from timeline spans/events
    """

    if bucket not in {"day", "third"}:
        raise ValueError("bucket must be 'day' or 'third'")

    snap = job_runner.snapshot(job_id)
    if snap.result is None or snap.req is None or snap.result.status != "ok":
        raise ValueError("job is not completed with status 'ok'")

    plan: ApiPlan = snap.req.plan  # type: ignore[assignment]
    if plan is None:
        raise ValueError("snapshot has no plan")

    start_day = 0
    end_day = plan.horizon.num_days

    # Lookups
    workers_by = {w.id: w for w in plan.workers}
    lands_by = {land.id: land for land in plan.lands}
    events_by = {e.id: e for e in plan.events}

    land_cap_by: dict[str, float] = {
        lid: land.normalized_area_a() for lid, land in lands_by.items()
    }

    # Accumulators
    labor_used_by_worker_day: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )
    land_used_by_land_day: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )

    timeline = snap.result.timeline
    if timeline is None:
        # No timeline; return empty records
        return TimelineResponse(interval=bucket, records=[])

    for span in timeline.land_spans:
        s = max(start_day, span.start_day)
        e = min(end_day, span.end_day)
        if e < s:
            continue
        for d in _iter_days(s, e):
            land_used_by_land_day[span.land_id][d] += float(span.area_a)

    for ev in timeline.events:
        d = ev.day
        if d < start_day or d > end_day:
            continue
        meta = events_by.get(ev.event_id)
        if meta is None:
            continue
        for wu in ev.worker_usages:
            if wu.hours > 0:
                labor_used_by_worker_day[wu.worker_id][d] += wu.hours

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
            for lid, land in lands_by.items():
                used = float(land_used_by_land_day[lid][d])
                cap = float(land_cap_by[lid])
                land_metrics.append(
                    LandMetric(
                        land_id=lid,
                        name=land.name,
                        utilization=used,
                        capacity=cap,
                    )
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
            labor_total = sum(x.utilization for x in worker_metrics)
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

    # bucket == 'third'
    # Require base_date for precise thirds
    if not base_date_iso:
        raise ValueError("base_date_iso is required for bucket 'third'")
    try:
        y, m, dd = [int(x) for x in base_date_iso.split("T")[0].split("-")]
        base_d = date(y, m, dd)
    except Exception:
        raise ValueError("base_date_iso must be ISO date 'YYYY-MM-DD'") from None

    # Group day indices by calendar thirds relative to base_date
    groups: dict[str, list[int]] = defaultdict(list)
    for d in _iter_days(start_day, end_day):
        groups[_third_key(d, base_d)].append(d)

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
        for lid, land in lands_by.items():
            used = sum(float(land_used_by_land_day[lid][d]) for d in days)
            cap = float(land_cap_by[lid]) * len(days)
            land_metrics.append(
                LandMetric(land_id=lid, name=land.name, utilization=used, capacity=cap)
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
        labor_total = sum(x.utilization for x in worker_metrics)
        labor_cap_total = sum(x.capacity for x in worker_metrics)
        land_total = sum(x.utilization for x in land_metrics)
        land_cap_total = sum(x.capacity for x in land_metrics)

        records.append(
            DayRecord(
                interval="third",
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

    return TimelineResponse(interval="third", records=records)
