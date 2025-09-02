from __future__ import annotations

from pydantic import BaseModel, Field


class Crop(BaseModel):
    id: str
    name: str
    category: str | None = None
    price_per_area: float | None = Field(None, description="円/a")


class Event(BaseModel):
    id: str
    crop_id: str
    name: str
    category: str | None = None  # 播種/定植/散水/収穫 等
    type: str | None = Field(None, description="one-shot | repeat | sustain")
    window: set[int] | None = None  # for one-shot
    start_window: set[int] | None = None  # for sustain
    duration_days: int | None = None  # for sustain
    start_cond: set[int] | None = None  # for repeat
    end_cond: set[int] | None = None  # for repeat
    frequency_days: int | None = None  # for repeat
    people_required: int | None = None
    labor_per_area_per_day: float | None = None
    required_roles: set[str] | None = None
    required_resources: set[str] | None = None


class Land(BaseModel):
    id: str
    name: str
    area: float  # a
    tags: set[str] | None = None
    blocked_days: set[int] | None = None


class Worker(BaseModel):
    id: str
    name: str
    roles: set[str] = Field(default_factory=set)
    capacity_per_day: float  # h/day
    blocked_days: set[int] | None = None


class Resource(BaseModel):
    id: str
    name: str
    category: str | None = None
    capacity_per_day: float | None = None
    blocked_days: set[int] | None = None


class CropAreaBound(BaseModel):
    crop_id: str
    min_area: float | None = None
    max_area: float | None = None


class FixedArea(BaseModel):
    land_id: str
    crop_id: str
    area: float


class Preferences(BaseModel):
    # weights are non-negative; tech.md: stage-wise/hybrid discussed, keep as simple weights for now
    w_profit: float = 1.0
    w_labor: float = 1.0
    w_idle: float = 1.0
    w_dispersion: float = 1.0
    w_peak: float = 1.0
    w_diversity: float = 1.0


class Horizon(BaseModel):
    # Period represented as discrete days (tech: “期間は時間窓 (h)”; we use day index, extendable)
    num_days: int


class PlanRequest(BaseModel):
    horizon: Horizon
    crops: list[Crop]
    events: list[Event]
    lands: list[Land]
    workers: list[Worker]
    resources: list[Resource]
    crop_area_bounds: list[CropAreaBound] | None = None
    fixed_areas: list[FixedArea] | None = None
    harvest_capacity_per_day: dict[int, float] | None = None
    preferences: Preferences | None = None


class PlanDiagnostics(BaseModel):
    feasible: bool
    reason: str | None = None
    violated_constraints: list[str] | None = None


class PlanAssignment(BaseModel):
    # Minimal surface for now; extend later with detailed per-day schedules
    crop_area_by_land: dict[str, dict[str, float]] = Field(
        default_factory=dict, description="land_id -> crop_id -> area"
    )


class PlanResponse(BaseModel):
    diagnostics: PlanDiagnostics
    assignment: PlanAssignment
