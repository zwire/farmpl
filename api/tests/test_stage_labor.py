from __future__ import annotations

from lib.planner import plan
from lib.schemas import Crop, Event, Horizon, Land, PlanRequest, Worker


def _build_two_crop_request(
    price1: float,
    price2: float,
    labor1: float,
    labor2: float,
    *,
    area: float = 1.0,
    days: int = 2,
) -> PlanRequest:
    """Two crops on one land with identical windows; differing prices and labor.

    - Both events use land and can run on any day in [1..days].
    - One worker has enough capacity to satisfy either choice.
    - Without labor stage, profit pushes to the higher effective price crop.
    - With labor stage (and profit being tied or relaxed),
      the lower-labor crop is preferred.
    """

    crops = [
        Crop(id="C1", name="A", price_per_area=price1),
        Crop(id="C2", name="B", price_per_area=price2),
    ]
    events = [
        Event(
            id="E1",
            crop_id="C1",
            name="work1",
            start_cond=set(range(1, days + 1)),
            end_cond=set(range(1, days + 1)),
            labor_total_per_area=labor1,
            labor_daily_cap=24.0,
            uses_land=True,
        ),
        Event(
            id="E2",
            crop_id="C2",
            name="work2",
            start_cond=set(range(1, days + 1)),
            end_cond=set(range(1, days + 1)),
            labor_total_per_area=labor2,
            labor_daily_cap=24.0,
            uses_land=True,
        ),
    ]
    lands = [Land(id="L1", name="F1", area=area)]
    # Single worker, enough capacity (per-day 24h)
    workers = [Worker(id="W1", name="w", capacity_per_day=24.0)]
    return PlanRequest(
        horizon=Horizon(num_days=days),
        crops=crops,
        events=events,
        lands=lands,
        workers=workers,
        resources=[],
    )


def _used_crops(resp) -> set[str]:
    used: set[str] = set()
    for _land, by_t in (resp.assignment.crop_area_by_land_t or {}).items():
        for _t, crops in by_t.items():
            for cid, area in crops.items():
                if area and area > 0:
                    used.add(cid)
    return used


def test_labor_stage_prefers_lower_labor_when_profit_tied() -> None:
    # Choose prices that round to the same unit price internally (scale=10):
    # 120.0 -> 12, 121.0 -> 12.1 -> rounds to 12
    req = _build_two_crop_request(
        price1=120.0, price2=121.0, labor1=10.0, labor2=2.0, days=1
    )
    resp = plan(
        req,
        stage_order=["profit", "labor"],
        lock_tolerance_pct=0.0,
    )
    assert resp.diagnostics.feasible
    used = _used_crops(resp)
    # With equal profit, labor stage should pick the lower labor crop C2
    assert used == {"C2"}
    # And objective 'labor' should equal total hours ≈ 2.0 (area=1.0 * 2h/a)
    labor_h = resp.objectives.get("labor")
    assert labor_h is not None
    assert abs(labor_h - 2.0) < 1e-6


def test_labor_stage_trades_profit_with_tolerance() -> None:
    # C1 is higher price, higher labor; C2 is 5% cheaper, much lower labor.
    # Internal unit prices: 120.0->12, 114.0->11; with 10% tolerance, C2 is allowed.
    req = _build_two_crop_request(
        price1=120.0, price2=114.0, labor1=10.0, labor2=2.0, days=1
    )
    # First, get the theoretical max profit with profit-only
    baseline = plan(req, stage_order=["profit"], lock_tolerance_pct=0.0)
    assert baseline.diagnostics.feasible
    max_profit = baseline.objectives.get("profit") or 0.0

    # Now, allow 10% relaxation on profit and minimize labor
    resp = plan(
        req,
        stage_order=["profit", "labor"],
        lock_tolerance_pct=0.10,  # 10%
    )
    assert resp.diagnostics.feasible
    used = _used_crops(resp)
    # Expect the low-labor crop to be selected under relaxed profit
    assert used == {"C2"}

    # Profit should stay within tolerance
    tol_profit = (1.0 - 0.10) * max_profit
    assert (resp.objectives.get("profit") or 0.0) >= tol_profit - 1e-6

    # And labor should be strictly lower than the high-labor option
    assert (resp.objectives.get("labor") or 0.0) < 10.0
