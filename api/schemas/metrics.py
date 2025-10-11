"""
Metrics timeline view models (Pydantic v2).

These are lightweight response/view schemas used by the metrics timeline
endpoint. They intentionally avoid schema-version fields and "over" flags.

Conventions
- Day indices are 0-based (see design).
- For interval 'day', `day_index` must be set and `period_key` must be None.
- For interval 'third', `period_key` must be set and `day_index` must be None.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventMetric(BaseModel):
    """Event marker within a day or aggregated bucket.

    - id: Original event id
    - label: Display label (usually event name)
    - start_day: Day index (0-based)
    - end_day: Optional end day index (inclusive). None for single-day markers.
    - type: Optional category string (e.g., sowing/harvest)
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    start_day: int = Field(ge=0)
    end_day: int | None = Field(default=None, ge=0)
    type: str | None = None


class WorkerMetric(BaseModel):
    """Per-worker labor usage and capacity within a bucket."""

    model_config = ConfigDict(extra="forbid")

    worker_id: str
    name: str
    utilization: float = Field(ge=0)
    capacity: float = Field(ge=0)


class LandMetric(BaseModel):
    """Per-land area usage and capacity within a bucket."""

    model_config = ConfigDict(extra="forbid")

    land_id: str
    name: str
    utilization: float = Field(ge=0)
    capacity: float = Field(ge=0)


class DaySummary(BaseModel):
    """Summary totals per bucket."""

    model_config = ConfigDict(extra="forbid")

    labor_total_hours: float = Field(default=0.0, ge=0)
    labor_capacity_hours: float = Field(default=0.0, ge=0)
    land_total_area: float = Field(default=0.0, ge=0)
    land_capacity_area: float = Field(default=0.0, ge=0)


class DayRecord(BaseModel):
    """One timeline bucket: a single day or a third group.

    Exactly one of (day_index, period_key) must be set depending on interval.
    """

    model_config = ConfigDict(extra="forbid")

    interval: Literal["day", "third"]
    day_index: int | None = Field(default=None, ge=0)
    period_key: str | None = None
    events: list[EventMetric] = Field(default_factory=list)
    workers: list[WorkerMetric] = Field(default_factory=list)
    lands: list[LandMetric] = Field(default_factory=list)
    summary: DaySummary = Field(default_factory=DaySummary)

    @model_validator(mode="after")
    def _check_index_vs_key(self):
        if self.interval == "day":
            if self.day_index is None or self.period_key is not None:
                raise ValueError(
                    "For interval='day', day_index must be set and "
                    "period_key must be None"
                )
        else:
            if self.period_key is None or self.day_index is not None:
                raise ValueError(
                    "For interval='third', period_key must be set and "
                    "day_index must be None"
                )
        return self


class TimelineResponse(BaseModel):
    """Top-level response for the metrics timeline endpoint."""

    model_config = ConfigDict(extra="forbid")

    interval: Literal["day", "third"]
    records: list[DayRecord] = Field(default_factory=list)


__all__ = [
    "EventMetric",
    "WorkerMetric",
    "LandMetric",
    "DaySummary",
    "DayRecord",
    "TimelineResponse",
]
