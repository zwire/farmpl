from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from lib.thirds import period_key as third_period_key
from schemas import ApiPlan
from schemas.metrics import (
    EventMetric,
    LandMetric,
    PeriodRecord,
    PeriodSummary,
    TimelineResponse,
    WorkerMetric,
)

from . import job_runner


def _third_sequence_with_counts(
    base_date: date, horizon_days: int
) -> list[tuple[str, int]]:
    """Return ordered (period_key, day_count) sequence covering the horizon days.

    Example: starting 2025-01-08 for 25 days ->
    [ ("2025-01:上旬", 3), ("2025-01:中旬", 10), ("2025-01:下旬", 10), ("2025-02:上旬", 2) ]
    """
    seq: list[tuple[str, int]] = []
    cur_key: str | None = None
    cur_count = 0
    for d in range(horizon_days):
        k = third_period_key(base_date + timedelta(days=d))
        if k != cur_key:
            if cur_key is not None:
                seq.append((cur_key, cur_count))
            cur_key, cur_count = k, 1
        else:
            cur_count += 1
    if cur_key is not None:
        seq.append((cur_key, cur_count))
    return seq


def aggregate(
    job_id: str,
    *,
    base_date_iso: str | None = None,
) -> TimelineResponse:
    """Aggregate worker/land utilization per day or decade from a completed job.

    - Uses job_backend snapshot (no re-optimization)
    - Reads capacities from plan; usage from timeline spans/events
    """

    snap = job_runner.snapshot(job_id)
    if snap.result is None or snap.req is None or snap.result.status != "ok":
        raise ValueError("job is not completed with status 'ok'")

    plan: ApiPlan = snap.req.plan  # type: ignore[assignment]
    if plan is None:
        raise ValueError("snapshot has no plan")

    # Lookups
    workers_by = {w.id: w for w in plan.workers}
    lands_by = {land.id: land for land in plan.lands}
    events_by = {e.id: e for e in plan.events}

    land_cap_by: dict[str, float] = {
        lid: land.normalized_area_a() for lid, land in lands_by.items()
    }

    # Accumulators
    labor_used_by_worker_t: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )
    land_used_by_land_t: dict[str, dict[int, float]] = defaultdict(
        lambda: defaultdict(float)
    )

    timeline = snap.result.timeline
    if timeline is None:
        # No timeline; return empty records
        return TimelineResponse(records=[])

    for span in timeline.land_spans:
        # Timeline indices are per-third (0-based) after compression
        s = max(0, span.start_index)
        e = max(s, span.end_index)
        for d in range(s, e + 1):
            land_used_by_land_t[span.land_id][d] += float(span.area_a)

    for ev in timeline.events:
        d = ev.index
        if d < 0:
            continue
        meta = events_by.get(ev.event_id)
        if meta is None:
            continue
        for wu in ev.worker_usages:
            if wu.hours > 0:
                labor_used_by_worker_t[wu.worker_id][d] += wu.hours

    # Build records (third-native)
    # Require base_date for precise thirds/labels and day-count per third
    if not base_date_iso:
        raise ValueError("base_date_iso is required for bucket 'third'")
    try:
        y, m, dd = [int(x) for x in base_date_iso.split("T")[0].split("-")]
        base_d = date(y, m, dd)
    except Exception:
        raise ValueError("base_date_iso must be ISO date 'YYYY-MM-DD'") from None

    # Determine number of thirds actually present in the timeline by inspecting keys
    third_indices_seen: set[int] = set()
    for by_d in labor_used_by_worker_t.values():
        third_indices_seen.update(by_d.keys())
    for by_d in land_used_by_land_t.values():
        third_indices_seen.update(by_d.keys())
    for ev in timeline.events or []:
        third_indices_seen.add(int(ev.index))
    T = (max(third_indices_seen) + 1) if third_indices_seen else 0

    thirds_seq = _third_sequence_with_counts(base_d, plan.horizon.num_days)
    thirds_seq = thirds_seq[:T]

    records: list[PeriodRecord] = []
    for t, (key, day_count) in enumerate(thirds_seq):
        # Workers
        worker_metrics: list[WorkerMetric] = []
        for wid, w in workers_by.items():
            used = float(labor_used_by_worker_t[wid][t])
            cap = float(w.capacity_per_day) * float(day_count)
            worker_metrics.append(
                WorkerMetric(worker_id=wid, name=w.name, utilization=used, capacity=cap)
            )

        # Lands
        land_metrics: list[LandMetric] = []
        for lid, land in lands_by.items():
            used_area = float(land_used_by_land_t[lid][t])
            # Convert to area-thirds by multiplying with actual days in this third
            used = used_area * float(day_count)
            cap = float(land_cap_by[lid]) * float(day_count)
            land_metrics.append(
                LandMetric(land_id=lid, name=land.name, utilization=used, capacity=cap)
            )

        # Events in group
        event_metrics: list[EventMetric] = []
        for ev in timeline.events:
            if ev.index == t:
                meta = events_by.get(ev.event_id)
                label = meta.name if meta is not None else ev.event_id
                etype = meta.category if meta is not None else None
                event_metrics.append(
                    EventMetric(
                        id=ev.event_id,
                        label=label,
                        start_index=ev.index,
                        end_index=None,
                        type=etype,
                    )
                )

        # Summary
        labor_total = sum(x.utilization for x in worker_metrics)
        labor_cap_total = sum(x.capacity for x in worker_metrics)
        land_total = sum(x.utilization for x in land_metrics)
        land_cap_total = sum(x.capacity for x in land_metrics)

        records.append(
            PeriodRecord(
                index=t,
                period_key=key,
                events=event_metrics,
                workers=worker_metrics,
                lands=land_metrics,
                summary=PeriodSummary(
                    labor_total_hours=labor_total,
                    labor_capacity_hours=labor_cap_total,
                    land_total_area=land_total,
                    land_capacity_area=land_cap_total,
                ),
            )
        )

    return TimelineResponse(records=records)
