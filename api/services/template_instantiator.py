from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from uuid import uuid4

from schemas.optimization import (
    ApiCrop,
    ApiEvent,
    ApiHorizon,
    ApiPlan,
)
from schemas.templates import CropTemplate

"""Instantiate a CropTemplate into strict ApiPlan with seasonal adjustments."""


def _scale_days(v: int, factor: float) -> int:
    return max(1, int(round(v * factor)))


def _scale_pair(p: tuple[int, int], factor: float) -> tuple[int, int]:
    lo, hi = p
    return (_scale_days(lo, factor), _scale_days(hi, factor))


@dataclass(frozen=True)
class InstantiateOptions:
    start_date: date
    horizon_days: int
    price_per_a_override: float | None = None
    crop_id_override: str | None = None
    crop_name_override: str | None = None


def _to_api_events(
    tpl: CropTemplate,
    factor: float,
    crop_id: str,
    event_id_map: dict[str, str],
) -> Iterable[ApiEvent]:
    for e in tpl.events:
        start_cond = None
        end_cond = None
        if e.start_window_days is not None:
            s, e2 = e.start_window_days
            start_cond = set(range(s, e2 + 1))
            end_cond = set(range(s, e2 + 1))

        lag_min = None
        lag_max = None
        pred = e.preceding_event_id
        mapped_preceding = event_id_map.get(pred, pred) if pred else None
        if e.lag_days is not None:
            if e.seasonal_scale:
                lag_min, lag_max = _scale_pair(e.lag_days, factor)
            else:
                lag_min, lag_max = e.lag_days

        yield ApiEvent(
            id=event_id_map.get(e.id, e.id),
            crop_id=crop_id,
            name=e.name,
            category=e.category,
            start_cond=start_cond,
            end_cond=end_cond,
            frequency_days=e.frequency_days,
            preceding_event_id=mapped_preceding,
            lag_min_days=lag_min,
            lag_max_days=lag_max,
            people_required=e.people_required,
            labor_total_per_a=e.labor_total_per_a,
            labor_daily_cap=e.labor_daily_cap,
            required_roles=e.required_roles,
            required_resources=e.required_resources,
            uses_land=e.uses_land,
        )


def instantiate(tpl: CropTemplate, opts: InstantiateOptions) -> ApiPlan:
    factor = tpl.seasonal.factor_for(opts.start_date)
    price_a = (
        float(opts.price_per_a_override)
        if opts.price_per_a_override is not None
        else (
            tpl.price_per_a
            if tpl.price_per_a is not None
            else (tpl.price_per_10a or 0.0) / 10.0
        )
    )

    crop_id = opts.crop_id_override or str(uuid4())

    crop = ApiCrop(
        id=crop_id,
        name=opts.crop_name_override
        or tpl.crop_name + (f"({tpl.variant})" if tpl.variant else ""),
        category=tpl.category,
        price_per_a=price_a,
    )

    event_id_map: dict[str, str] = {event.id: str(uuid4()) for event in tpl.events}
    events = list(_to_api_events(tpl, factor, crop_id, event_id_map))

    plan = ApiPlan(
        horizon=ApiHorizon(
            num_days=opts.horizon_days,
            start_date=opts.start_date,
        ),
        crops=[crop],
        events=events,
        lands=[],
        workers=[],
        resources=[],
    )
    return plan
