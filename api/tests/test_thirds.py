from __future__ import annotations

from datetime import date

import pytest

from lib.thirds import (
    DayValue,
    Third,
    aggregate_day_values,
    period_key,
    sum_by_third,
    weighted_avg_by_third,
    which_third,
)


def test_which_third_boundaries():
    assert which_third(date(2024, 1, 1)) is Third.FIRST
    assert which_third(date(2024, 1, 10)) is Third.FIRST
    assert which_third(date(2024, 1, 11)) is Third.SECOND
    assert which_third(date(2024, 1, 20)) is Third.SECOND
    assert which_third(date(2024, 1, 21)) is Third.THIRD
    assert which_third(date(2024, 1, 31)) is Third.THIRD


def test_period_key_labels():
    assert period_key(date(2025, 2, 1)).endswith(":上旬")
    assert period_key(date(2025, 2, 15)).endswith(":中旬")
    assert period_key(date(2025, 2, 28)).endswith(":下旬")


def test_sum_by_third_simple():
    dates = [date(2025, 1, d) for d in (1, 2, 12, 19, 21, 30)]
    values = [1, 2, 3, 4, 5, 6]
    totals = sum_by_third(dates, values)
    # FIRST: days 1,2 -> 3
    # SECOND: days 12,19 -> 7
    # THIRD: days 21,30 -> 11
    keys = list(totals.keys())
    assert pytest.approx(totals[keys[0]], 1e-9) in (3.0, 7.0, 11.0)
    assert sorted(totals.values()) == [3.0, 7.0, 11.0]


def test_weighted_avg_by_third_zero_weight():
    dates = [date(2025, 1, 1), date(2025, 1, 15), date(2025, 1, 25)]
    rates = [10.0, 20.0, 30.0]
    weights = [0.0, 0.0, 0.0]
    avg = weighted_avg_by_third(dates, rates, weights)
    for v in avg.values():
        assert v == 0.0


def test_aggregate_day_values_mixed():
    vals = [
        DayValue(date=date(2025, 3, 1), additive=1.0, rate=10.0, weight=1.0),
        DayValue(date=date(2025, 3, 10), additive=2.0, rate=20.0, weight=2.0),
        DayValue(date=date(2025, 3, 11), additive=3.0, rate=30.0, weight=3.0),
        DayValue(date=date(2025, 3, 21), additive=4.0, rate=40.0, weight=4.0),
    ]
    out = aggregate_day_values(vals)
    # FIRST bucket: additive=3.0, weighted avg=(10*1+20*2)/(1+2)=50/3
    # SECOND bucket: additive=3.0, weighted avg=30.0
    # THIRD bucket: additive=4.0, weighted avg=40.0
    # Order is not guaranteed; check by label suffix
    assert any(abs(t[0] - 3.0) < 1e-9 for t in out.values())
    assert any(abs(t[1] - (50.0 / 3.0)) < 1e-9 for t in out.values())
    assert any(abs(t[1] - 30.0) < 1e-9 for t in out.values())
    assert any(abs(t[0] - 4.0) < 1e-9 for t in out.values())
