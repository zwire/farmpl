from __future__ import annotations

from lib.constraints import (
    EventsWindowConstraint,
    FixedAreaConstraint,
    HoldAreaConstConstraint,
    LandCapacityConstraint,
    LinkAreaUseConstraint,
)
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Event, FixedArea, Horizon, Land, PlanRequest
from lib.solver import solve


def test_hold_area_const_with_fixed_area_is_feasible_after_fix() -> None:
    """HoldAreaConstConstraint を連続占有内のみ等式拘束に修正後は可行となる。

    - E1(uses_land=False) を day1、E2(uses_land=True) を day3 に設定。
    - E2 は E1 に 2〜3日のラグで依存（day3 が唯一の占有日）。
    - FixedArea で L1/C1 の base を >= 1.0a に要求。

    修正により、占有開始境界（day3）では前日(day2, occ=0)の値に等式で縛られないため、
    day3 に base を確保でき、全体が FEASIBLE/OPTIMAL となる。
    """

    H = 6
    req = PlanRequest(
        horizon=Horizon(num_days=H),
        crops=[Crop(id="C1", name="A", price_per_area=10.0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="prep",
                start_cond={1},
                end_cond={1},
                uses_land=False,
            ),
            Event(
                id="E2",
                crop_id="C1",
                name="occupy",
                start_cond={3},
                end_cond={3},
                preceding_event_id="E1",
                lag_min_days=2,
                lag_max_days=3,
                uses_land=True,
            ),
        ],
        lands=[Land(id="L1", name="F1", tag="tag", area=1.0)],
        workers=[],
        resources=[],
        fixed_areas=[FixedArea(land_tag="tag", crop_id="C1", area=1.0)],
    )

    ctx = build_model(
        req,
        [
            LandCapacityConstraint(),
            LinkAreaUseConstraint(),
            FixedAreaConstraint(),
            HoldAreaConstConstraint(),
            EventsWindowConstraint(),
        ],
        [ProfitObjective()],
    )
    res = solve(ctx)

    assert res.status in ("FEASIBLE", "OPTIMAL")
    # 具体的な r/occ の形状は実装差異があり得るため、可行性のみを確認
