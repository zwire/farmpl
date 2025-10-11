from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
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
from services.job_backend import JobSnapshot


def _snapshot_ok() -> JobSnapshot:
    plan = ApiPlan(
        horizon=ApiHorizon(num_days=20),
        crops=[ApiCrop(id="c1", name="作物", price_per_a=1000)],
        events=[
            ApiEvent(
                id="e1",
                crop_id="c1",
                name="播種",
                labor_total_per_a=1.0,
                uses_land=True,
            )
        ],
        lands=[ApiLand(id="L1", name="畑1", area_a=1.0)],
        workers=[ApiWorker(id="W1", name="Alice", capacity_per_day=8.0)],
        resources=[],
    )
    land_spans = [
        GanttLandSpan(land_id="L1", crop_id="c1", start_day=0, end_day=9, area_a=1.0)
    ]
    events = [
        GanttEventItem(
            day=0,
            event_id="e1",
            crop_id="c1",
            land_ids=["L1"],
            worker_ids=["W1"],
            resource_ids=[],
        )
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


def test_metrics_timeline_happy_path(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    app = create_app()

    def fake_snapshot(job_id: str) -> JobSnapshot:
        assert job_id == "jid"
        return _snapshot_ok()

    monkeypatch.setattr("services.job_runner.snapshot", fake_snapshot)
    client = TestClient(app)

    r = client.get(
        "/v1/metrics/timeline",
        params={
            "job_id": "jid",
            "start_day": 0,
            "end_day": 9,
            "bucket": "third",
            "base_date": "2024-01-01",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["interval"] == "third"
    assert len(data["records"]) == 1
    assert data["records"][0]["period_key"] == "2024-01:U"


def test_metrics_timeline_invalid_bucket_validation(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")
    app = create_app()
    client = TestClient(app)
    # FastAPI will 422 for invalid Literal
    r = client.get(
        "/v1/metrics/timeline",
        params={"job_id": "jid", "start_day": 0, "end_day": 1, "bucket": "foo"},
    )
    assert r.status_code == 422


def test_metrics_timeline_bad_ranges(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")

    def fake_snapshot(job_id: str) -> JobSnapshot:
        assert job_id == "jid"
        return _snapshot_ok()

    app = create_app()
    monkeypatch.setattr("services.job_runner.snapshot", fake_snapshot)
    client = TestClient(app)

    r = client.get(
        "/v1/metrics/timeline",
        params={
            "job_id": "jid",
            "start_day": 19,
            "end_day": 25,
            "bucket": "day",
        },
    )
    assert r.status_code == 422


def test_metrics_timeline_unknown_job(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "none")

    def fake_snapshot(job_id: str) -> JobSnapshot:
        raise KeyError(job_id)

    app = create_app()
    monkeypatch.setattr("services.job_runner.snapshot", fake_snapshot)
    client = TestClient(app)

    r = client.get(
        "/v1/metrics/timeline",
        params={
            "job_id": "nope",
            "start_day": 0,
            "end_day": 1,
            "bucket": "day",
        },
    )
    assert r.status_code == 404
