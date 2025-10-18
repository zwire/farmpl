"""
Metrics timeline view models (Pydantic v2).

These are lightweight response/view schemas used by the metrics timeline
endpoint. They intentionally avoid schema-version fields and "over" flags.

Conventions
- Day indices are 0-based (see design).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class EventMetric(BaseModel):
    """Event marker within a day or aggregated bucket.

    - id: Original event id
    - label: Display label (usually event name)
    - start_index: Day index (0-based)
    - end_index: Optional end day index (inclusive). None for single-day markers.
    - type: Optional category string (e.g., sowing/harvest)
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    start_index: int = Field(ge=0)
    end_index: int | None = Field(default=None, ge=0)
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


class PeriodSummary(BaseModel):
    """Summary totals per period."""

    model_config = ConfigDict(extra="forbid")

    labor_total_hours: float = Field(default=0.0, ge=0)
    labor_capacity_hours: float = Field(default=0.0, ge=0)
    land_total_area: float = Field(default=0.0, ge=0)
    land_capacity_area: float = Field(default=0.0, ge=0)


class PeriodRecord(BaseModel):
    """One timeline period: a single day or a third group.

    Exactly one of (index, period_key) must be set.
    """

    model_config = ConfigDict(extra="forbid")

    index: int = Field(ge=0)
    period_key: str
    events: list[EventMetric] = Field(default_factory=list)
    workers: list[WorkerMetric] = Field(default_factory=list)
    lands: list[LandMetric] = Field(default_factory=list)
    summary: PeriodSummary = Field(default_factory=PeriodSummary)


class TimelineResponse(BaseModel):
    """Top-level response for the metrics timeline endpoint."""

    model_config = ConfigDict(extra="forbid")

    records: list[PeriodRecord] = Field(default_factory=list)


__all__ = [
    "EventMetric",
    "WorkerMetric",
    "LandMetric",
    "PeriodSummary",
    "PeriodRecord",
    "TimelineResponse",
]
