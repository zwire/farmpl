from __future__ import annotations

import csv
import io
import zipfile
from datetime import date

from fastapi import HTTPException

from schemas.export import ExportSummary
from schemas.optimization import OptimizationResult


def _third_name(day_of_month: int) -> str:
    if day_of_month <= 10:
        return "上旬"
    if day_of_month <= 20:
        return "中旬"
    return "下旬"


def _advance_to_next_third(d: date) -> date:
    dom = d.day
    if dom <= 10:
        return date(d.year, d.month, 11)
    if dom <= 20:
        return date(d.year, d.month, 21)
    # move to first day of next month
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def _label_for_third(start_date: date, index: int) -> str:
    cur = start_date
    for _ in range(index):
        cur = _advance_to_next_third(cur)
    return f"{cur.month}月{_third_name(cur.day)}"


def render_zip_csv(summary: ExportSummary, *, result: OptimizationResult) -> bytes:
    """ExportSummary を複数のCSVに分けZIPで返す。

    - crops.csv: 作物別の面積・収益・コスト・粗利
    - totals.csv: 合計とピーク指標
    - 追加で将来 gantt.csv 等を拡張予定（現時点では totals のみ）
    """
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # crops.csv
        with zf.open("crops.csv", "w") as f:
            with io.TextIOWrapper(f, encoding="utf-8", newline="") as w:
                w.write("\ufeff")
                writer = csv.writer(w)
                writer.writerow(
                    [
                        "作物ID",
                        "作物名",
                        "面積[a]",
                        "単価[円/a]",
                        "売上[円]",
                        "労務時間[h]",
                        "労務費[円]",
                    ]
                )
                for r in summary.rows:
                    writer.writerow(
                        [
                            r.crop_id,
                            r.crop_name or "",
                            round(r.area_a, 3),
                            round(r.price_per_a, 2),
                            round(r.revenue_yen, 0),
                            round(r.labor_hours, 2),
                            round(r.labor_cost_yen, 0),
                        ]
                    )

        # totals.csv
        with zf.open("totals.csv", "w") as f:
            with io.TextIOWrapper(f, encoding="utf-8", newline="") as w:
                w.write("\ufeff")
                writer = csv.writer(w)
                writer.writerow(["総売上[円]", "総労務費[円]", "ピーク作業時間[h]"])
                writer.writerow(
                    [
                        round(summary.total_revenue_yen, 0),
                        round(summary.total_labor_cost_yen, 0),
                        (
                            ""
                            if summary.peak_worker_hours is None
                            else round(summary.peak_worker_hours, 2)
                        ),
                    ]
                )

        # gantt_events.csv
        if result.timeline and result.timeline.events:
            with zf.open("gantt_events.csv", "w") as f:
                with io.TextIOWrapper(f, encoding="utf-8", newline="") as w:
                    w.write("\ufeff")
                    writer = csv.writer(w)
                    writer.writerow(
                        [
                            "イベントID",
                            "作物ID",
                            "イベント名",
                            "圃場ID（|区切り）",
                            "労務時間合計[h]",
                        ]
                    )
                    for e in result.timeline.events:
                        land_ids = [str(x) for x in (e.land_ids or [])]
                        total_hours = sum(
                            ((wu.hours or 0.0) for wu in (e.worker_usages or [])), 0.0
                        )
                        writer.writerow(
                            [
                                e.event_id,
                                e.crop_id,
                                e.event_name or "",
                                "|".join(land_ids),
                                round(total_hours, 2),
                            ]
                        )

        if summary.worker_period_rows:
            with zf.open("worker_hours_by_period.csv", "w") as f:
                with io.TextIOWrapper(f, encoding="utf-8", newline="") as w:
                    w.write("\ufeff")
                    writer = csv.writer(w)
                    writer.writerow(
                        ["期間", "作業者ID", "作業者名", "役割", "労務時間[h]"]
                    )
                    # Derive labels from timeline.start_date when available
                    start_date_iso = getattr(
                        getattr(result, "timeline", None), "start_date", None
                    )
                    start_date_obj: date | None = None
                    if isinstance(start_date_iso, str) and start_date_iso:
                        try:
                            y, m, d = map(int, start_date_iso.split("-")[:3])
                            start_date_obj = date(y, m, d)
                        except Exception:
                            start_date_obj = None
                    elif isinstance(start_date_iso, date):
                        start_date_obj = start_date_iso
                    for row in summary.worker_period_rows:
                        label = (
                            _label_for_third(start_date_obj, row.period_index)
                            if start_date_obj is not None
                            else f"期間#{row.period_index}"
                        )
                        writer.writerow(
                            [
                                label,
                                row.worker_id,
                                row.worker_name or "",
                                ";".join(row.roles or []),
                                round(row.hours, 2),
                            ]
                        )

    return mem.getvalue()


def ensure_result_ok(result_status: str | None) -> None:
    if result_status != "ok":
        raise HTTPException(status_code=422, detail={"message": "result is not ok"})
