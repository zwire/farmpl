from __future__ import annotations

from datetime import UTC, datetime

import pytest

from schemas import (
    ApiCrop,
    ApiEvent,
    ApiHorizon,
    ApiLand,
    ApiPlan,
    JobInfo,
    OptimizationRequest,
    OptimizationResult,
)


def test_optimization_request_forbid_extra() -> None:
    with pytest.raises(Exception):
        OptimizationRequest(params={}, extra_field="NG")  # type: ignore[arg-type]


def test_optimization_result_defaults() -> None:
    res = OptimizationResult(status="ok")
    assert res.stats == {}
    assert res.warnings == []
    assert res.objective_value is None or isinstance(res.objective_value, float)
    assert getattr(res, "timeline", None) is None


def test_job_info_progress_bounds() -> None:
    now = datetime.now(UTC)
    JobInfo(job_id="j1", status="pending", progress=0.0, submitted_at=now)
    JobInfo(job_id="j2", status="running", progress=1.0, submitted_at=now)
    with pytest.raises(Exception):
        JobInfo(job_id="j3", status="running", progress=-0.01, submitted_at=now)
    with pytest.raises(Exception):
        JobInfo(job_id="j4", status="running", progress=1.01, submitted_at=now)


def test_plan_requires_event_per_crop() -> None:
    horizon = ApiHorizon(num_days=5)
    crops = [ApiCrop(id="c1", name="ほうれん草", price_per_10a=100000)]
    lands = [ApiLand(id="l1", name="L1", area_10a=2)]
    with pytest.raises(Exception) as ei:
        ApiPlan(
            horizon=horizon,
            crops=crops,
            events=[],
            lands=lands,
            workers=[],
            resources=[],
        )
    assert "作物に関連するイベントがありません" in str(ei.value)


def test_land_area_unit_exclusive() -> None:
    with pytest.raises(Exception):
        ApiLand(id="l1", name="L1", area_a=10, area_10a=1)


def test_blocked_days_range() -> None:
    horizon = ApiHorizon(num_days=3)
    crops = [ApiCrop(id="c1", name="作物", price_per_a=1000)]
    events = [ApiEvent(id="e1", crop_id="c1", name="播種", uses_land=True)]
    lands = [ApiLand(id="l1", name="L1", area_10a=1, blocked_days={5})]
    with pytest.raises(Exception) as ei:
        ApiPlan(
            horizon=horizon,
            crops=crops,
            events=events,
            lands=lands,
            workers=[],
            resources=[],
        )
    assert "blocked_days" in str(ei.value)


def test_event_precedence_and_same_crop() -> None:
    horizon = ApiHorizon(num_days=3)
    crops = [ApiCrop(id="c1", name="作物", price_per_a=1000)]
    e1 = ApiEvent(id="e1", crop_id="c1", name="播種", uses_land=True)
    e2 = ApiEvent(
        id="e2",
        crop_id="c1",
        name="収穫",
        preceding_event_id="e1",
        lag_min_days=1,
        lag_max_days=3,
    )
    lands = [ApiLand(id="l1", name="L1", area_a=10)]
    # OK case should not raise
    ApiPlan(
        horizon=horizon,
        crops=crops,
        events=[e1, e2],
        lands=lands,
        workers=[],
        resources=[],
    )

    # Predecessor not exists
    with pytest.raises(Exception):
        ApiPlan(
            horizon=horizon,
            crops=crops,
            events=[
                ApiEvent(id="e3", crop_id="c1", name="追肥", preceding_event_id="nope")
            ],
            lands=lands,
            workers=[],
            resources=[],
        )
