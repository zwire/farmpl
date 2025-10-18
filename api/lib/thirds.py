from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from enum import Enum

"""
Utilities for grouping and aggregating values by calendar thirds (旬).

Definitions
- FIRST: days 1–10
- SECOND: days 11–20
- THIRD: days 21–end of month

This module intentionally avoids coupling to API schemas. It provides
pure functions that accept Python `date` objects and numeric series so
that both the optimizer adapter and metrics layer can reuse them.
"""


class Third(Enum):
    FIRST = 1
    SECOND = 2
    THIRD = 3


def which_third(d: date) -> Third:
    """Return which third (旬) the given calendar date belongs to.

    - 1-10 -> FIRST
    - 11-20 -> SECOND
    - 21-end -> THIRD
    """

    dom = d.day
    if dom <= 10:
        return Third.FIRST
    if dom <= 20:
        return Third.SECOND
    return Third.THIRD


def period_key(d: date) -> str:
    """Return a stable textual key like 'YYYY-MM:上旬/中旬/下旬'."""

    label = {Third.FIRST: "上旬", Third.SECOND: "中旬", Third.THIRD: "下旬"}[
        which_third(d)
    ]
    return f"{d.year:04d}-{d.month:02d}:{label}"


def group_indices_by_third(dates: Sequence[date]) -> Mapping[str, list[int]]:
    """Group sequence indices by calendar third.

    Returns mapping: period_key -> list of indices in input order.
    """

    groups: dict[str, list[int]] = {}
    for i, d in enumerate(dates):
        key = period_key(d)
        groups.setdefault(key, []).append(i)
    return groups


def sum_by_third(dates: Sequence[date], values: Sequence[float]) -> Mapping[str, float]:
    """Sum additive values within each third.

    Length of `dates` and `values` must match.
    """

    if len(dates) != len(values):
        raise ValueError("dates and values must have the same length")
    totals: dict[str, float] = {}
    for i, d in enumerate(dates):
        key = period_key(d)
        totals[key] = totals.get(key, 0.0) + float(values[i])
    return totals


def weighted_avg_by_third(
    dates: Sequence[date], rates: Sequence[float], weights: Sequence[float]
) -> Mapping[str, float]:
    """Compute weighted averages per third.

    Averages are computed as sum(rate*weight)/sum(weight) per third.
    If the total weight in a bucket is zero, the average is 0.0.
    """

    if not (len(dates) == len(rates) == len(weights)):
        raise ValueError("dates, rates, and weights must have the same length")

    num: dict[str, float] = {}
    den: dict[str, float] = {}
    for i, d in enumerate(dates):
        key = period_key(d)
        w = float(weights[i])
        r = float(rates[i])
        num[key] = num.get(key, 0.0) + r * w
        den[key] = den.get(key, 0.0) + w

    avg: dict[str, float] = {}
    for k in num:
        wsum = den.get(k, 0.0)
        avg[k] = num[k] / wsum if wsum > 0 else 0.0
    return avg


@dataclass(slots=True)
class DayValue:
    """Helper record for combined aggregation use-cases.

    - additive: values that should be summed within a bucket
    - rate: values that should be averaged with weight
    - weight: weight used for averaging `rate`
    """

    date: date
    additive: float = 0.0
    rate: float = 0.0
    weight: float = 0.0


def aggregate_day_values(
    values: Iterable[DayValue],
) -> Mapping[str, tuple[float, float]]:
    """Aggregate DayValue records per third.

    Returns mapping: period_key -> (sum(additive), weighted_avg(rate; weight)).
    """

    num: dict[str, float] = {}
    den: dict[str, float] = {}
    tot: dict[str, float] = {}
    for v in values:
        key = period_key(v.date)
        tot[key] = tot.get(key, 0.0) + float(v.additive)
        w = float(v.weight)
        r = float(v.rate)
        num[key] = num.get(key, 0.0) + r * w
        den[key] = den.get(key, 0.0) + w

    out: dict[str, tuple[float, float]] = {}
    for k, t in tot.items():
        wsum = den.get(k, 0.0)
        avg = num.get(k, 0.0) / wsum if wsum > 0 else 0.0
        out[k] = (t, avg)
    return out
