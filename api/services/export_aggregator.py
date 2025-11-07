from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from schemas.export import (
    CropFinancialRow,
    ExportSummary,
    FinancialAssumptions,
    WorkerHoursRow,
    WorkerPeriodRow,
)
from schemas.optimization import ApiPlan, OptimizationResult


def _price_per_a(plan: ApiPlan, crop_id: str) -> float:
    for c in plan.crops:
        if c.id == crop_id:
            if c.price_per_a is not None:
                return float(c.price_per_a)
            if c.price_per_10a is not None:
                return float(c.price_per_10a) / 10.0
    return 0.0


def _crop_name(plan: ApiPlan | None, crop_id: str) -> str | None:
    if not plan:
        return None
    for c in plan.crops:
        if c.id == crop_id:
            return c.name
    return None


def _iter_spans(result: OptimizationResult):
    timeline = result.timeline
    if not timeline:
        return []
    return timeline.land_spans


def _iter_events(result: OptimizationResult):
    timeline = result.timeline
    if not timeline:
        return []
    return timeline.events


def aggregate_summary(
    *,
    result: OptimizationResult,
    plan: ApiPlan | None,
    assumptions: FinancialAssumptions,
) -> ExportSummary:
    # 面積（a）を作物別に合算
    area_by_crop: dict[str, float] = defaultdict(float)
    for span in _iter_spans(result):
        area_by_crop[span.crop_id] += float(span.area_a)

    # 労務時間（h）を作物別に合算（イベント→worker_usages）
    hours_by_crop: dict[str, float] = defaultdict(float)
    peak_hours = None
    peak_idx = None
    per_index_hours: dict[int, float] = defaultdict(float)
    hours_by_worker: dict[str, float] = defaultdict(float)
    hours_by_worker_period: dict[tuple[int, str], float] = defaultdict(float)
    for ev in _iter_events(result):
        total_ev_hours = 0.0
        for wu in ev.worker_usages or []:
            h = float(getattr(wu, "hours", 0.0) or 0.0)
            total_ev_hours += h
            if getattr(wu, "worker_id", None):
                hours_by_worker[wu.worker_id] += h
                hours_by_worker_period[(ev.index, wu.worker_id)] += h
        hours_by_crop[ev.crop_id] += total_ev_hours
        per_index_hours[ev.index] += total_ev_hours
    if per_index_hours:
        peak_idx, peak_hours = max(per_index_hours.items(), key=lambda kv: kv[1])

    # 収支計算
    rows: list[CropFinancialRow] = []
    wage = float(assumptions.wage_rate_per_hour)
    total_revenue = 0.0
    total_labor_cost = 0.0

    crop_ids: Iterable[str] = set(area_by_crop.keys()) | set(hours_by_crop.keys())
    for cid in sorted(crop_ids):
        price_a = _price_per_a(plan, cid) if plan else 0.0
        area = area_by_crop.get(cid, 0.0)
        revenue = price_a * area
        hours = hours_by_crop.get(cid, 0.0)
        labor_cost = wage * hours
        rows.append(
            CropFinancialRow(
                crop_id=cid,
                crop_name=_crop_name(plan, cid),
                area_a=area,
                price_per_a=price_a,
                revenue_yen=revenue,
                labor_hours=hours,
                labor_cost_yen=labor_cost,
            )
        )
        total_revenue += revenue
        total_labor_cost += labor_cost

    worker_rows = [
        WorkerHoursRow(worker_id=w, hours=h) for w, h in sorted(hours_by_worker.items())
    ]

    # Names and roles map
    name_by_worker: dict[str, str | None] = {}
    roles_by_worker: dict[str, list[str]] = {}
    if plan is not None:
        for w in plan.workers:
            name_by_worker[w.id] = w.name
            roles_by_worker[w.id] = sorted(w.roles or [])
    elif result.timeline and result.timeline.entity_names:
        names = result.timeline.entity_names.get("workers", {})
        for wid, nm in (names or {}).items():
            name_by_worker[str(wid)] = str(nm)
            roles_by_worker[str(wid)] = []

    worker_period_rows: list[WorkerPeriodRow] = []
    for (idx, wid), hours in sorted(hours_by_worker_period.items()):
        worker_period_rows.append(
            WorkerPeriodRow(
                period_index=int(idx),
                worker_id=wid,
                worker_name=name_by_worker.get(wid),
                roles=roles_by_worker.get(wid, []),
                hours=hours,
            )
        )

    return ExportSummary(
        rows=rows,
        total_revenue_yen=total_revenue,
        total_labor_cost_yen=total_labor_cost,
        peak_worker_hours=peak_hours,
        worker_rows=worker_rows,
        worker_period_rows=worker_period_rows,
    )
