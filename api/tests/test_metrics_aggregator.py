from __future__ import annotations

from schemas import (
    ApiCrop,
    ApiEvent,
    ApiHorizon,
    ApiLand,
    ApiPlan,
    ApiWorker,
    GanttEventItem,
    GanttLandSpan,
    JobInfo,
    OptimizationRequest,
    OptimizationResult,
    OptimizationTimeline,
)
from services import metrics_aggregator
from services.job_backend import JobSnapshot


def _make_snapshot() -> JobSnapshot:
    plan = ApiPlan(
        horizon=ApiHorizon(num_days=30),
        crops=[ApiCrop(id="c1", name="作物", price_per_a=1000)],
        events=[
            ApiEvent(
                id="e1",
                crop_id="c1",
                name="播種",
                category="sowing",
                labor_total_per_a=2.0,
                uses_land=True,
            ),
            ApiEvent(
                id="e2",
                crop_id="c1",
                name="収穫",
                category="harvest",
                labor_total_per_a=1.0,
                uses_land=True,
            ),
        ],
        lands=[
            ApiLand(id="L1", name="畑1", area_a=1.5),
            ApiLand(id="L2", name="畑2", area_a=2.0),
        ],
        workers=[
            ApiWorker(id="W1", name="Alice", capacity_per_day=8.0),
            ApiWorker(id="W2", name="Bob", capacity_per_day=6.0),
        ],
        resources=[],
        crop_area_bounds=None,
        fixed_areas=None,
        preferences=None,
        stages=None,
    )

    # Day 0-14 land occupancy for both lands
    land_spans = [
        GanttLandSpan(land_id="L1", crop_id="c1", start_day=0, end_day=14, area_a=1.5),
        GanttLandSpan(land_id="L2", crop_id="c1", start_day=0, end_day=14, area_a=2.0),
    ]

    # Events: day 3 with workers W1,W2; day 7 without workers
    events = [
        GanttEventItem(
            day=3,
            event_id="e1",
            crop_id="c1",
            land_ids=["L1", "L2"],
            worker_ids=["W1", "W2"],
            resource_ids=[],
        ),
        GanttEventItem(
            day=7,
            event_id="e2",
            crop_id="c1",
            land_ids=["L1", "L2"],
            worker_ids=[],
            resource_ids=[],
        ),
    ]

    timeline = OptimizationTimeline(
        land_spans=land_spans, events=events, entity_names={}
    )
    res = OptimizationResult(
        status="ok",
        objective_value=1.0,
        solution=None,
        stats={},
        warnings=[],
        timeline=timeline,
    )
    job = JobInfo(job_id="jid", status="succeeded", progress=1.0, result=res)
    req = OptimizationRequest(
        idempotency_key=None, plan=plan, params=None, timeout_ms=None, priority=None
    )
    return JobSnapshot(job=job, req=req, result=res)


def test_aggregate_day_and_decade(monkeypatch):
    snap = _make_snapshot()

    def fake_snapshot(job_id: str) -> JobSnapshot:
        assert job_id == "jid"
        return snap

    monkeypatch.setattr("services.job_runner.snapshot", fake_snapshot)

    # Day bucket 0..14
    resp_day = metrics_aggregator.aggregate("jid", 0, 14, "day")
    assert resp_day.interval == "day"
    assert len(resp_day.records) == 15
    # Check day 3 labor: labor_total_per_a (e1=2.0) * (1.5 + 2.0) = 7.0 total
    # Split across two workers → 3.5 each
    d3 = next(r for r in resp_day.records if r.day_index == 3)
    w1 = next(w for w in d3.workers if w.worker_id == "W1")
    w2 = next(w for w in d3.workers if w.worker_id == "W2")
    assert round(w1.utilization, 4) == 3.5
    assert round(w2.utilization, 4) == 3.5
    # Day 7 unassigned labor counted only in summary, not per-worker
    d7 = next(r for r in resp_day.records if r.day_index == 7)
    assert all(w.utilization == 0 for w in d7.workers)
    assert round(d7.summary.labor_total_hours, 4) == 1.0 * (1.5 + 2.0)

    # Land usage per day equals spans
    assert round(d3.summary.land_total_area, 4) == 1.5 + 2.0

    # Decade bucket 0..14 → two groups: 000:U (0..9) and 000:M (10..14)
    resp_dec = metrics_aggregator.aggregate("jid", 0, 14, "decade")
    assert resp_dec.interval == "decade"
    keys = {r.period_key for r in resp_dec.records}
    assert keys == {"000:U", "000:M"}
    # Totals add up: land capacity per group = (1.5+2.0)*days
    u = next(r for r in resp_dec.records if r.period_key == "000:U")
    m = next(r for r in resp_dec.records if r.period_key == "000:M")
    assert round(u.summary.land_capacity_area, 4) == (1.5 + 2.0) * 10
    assert round(m.summary.land_capacity_area, 4) == (1.5 + 2.0) * 5
