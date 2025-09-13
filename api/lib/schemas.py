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
    start_cond: set[int] | None = None
    end_cond: set[int] | None = None
    frequency_days: int | None = None
    # Optional dependency: start only Lmin..Lmax days after predecessor
    preceding_event_id: str | None = None
    lag_min_days: int | None = None
    lag_max_days: int | None = None
    people_required: int | None = None
    labor_total_per_area: float | None = Field(None, description="通算労働需要 (h/a)")
    labor_daily_cap: float | None = Field(None, description="日次労働上限 (h/日)")
    required_roles: set[str] | None = None
    required_resources: set[str] | None = None
    uses_land: bool = Field(False, description="このイベントが土地を占有する作業か")
    occupancy_effect: str | None = Field(
        None,
        description="start|hold|end|none: 作付け占有状態に対する効果",
        examples=["start", "hold", "end", "none"],
    )


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
    # Weights are non-negative; see tech.md for stage-wise/hybrid notes.
    # Keep as simple weights for now.
    w_profit: float = 1.0
    w_labor: float = 1.0
    w_idle: float = 1.0
    w_dispersion: float = 1.0
    w_peak: float = 1.0
    w_diversity: float = 1.0


class Horizon(BaseModel):
    # Period is represented as discrete days; see tech.md.
    # We use day index, extendable.
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
    preferences: Preferences | None = None


class PlanDiagnostics(BaseModel):
    feasible: bool
    reason: str | None = None
    violated_constraints: list[str] | None = None
    # Optional: lexicographic stages summary
    stages: list[dict] = Field(default_factory=list)
    stage_order: list[str] | None = None
    lock_tolerance_pct: float | None = None
    lock_tolerance_by: dict[str, float] | None = None


class PlanAssignment(BaseModel):
    # Time-indexed assignment: land -> day -> crop -> area
    crop_area_by_land_day: dict[str, dict[int, dict[str, float]]] = Field(
        default_factory=dict, description="land_id -> day -> crop_id -> area"
    )
    idle_by_land_day: dict[str, dict[int, float]] = Field(
        default_factory=dict, description="land_id -> day -> idle area"
    )


class WorkerRef(BaseModel):
    id: str
    name: str
    roles: list[str] = Field(default_factory=list)


class ResourceUsageRef(BaseModel):
    id: str
    name: str | None = None
    used_time_hours: float


class EventAssignment(BaseModel):
    day: int
    event_id: str
    assigned_workers: list[WorkerRef] = Field(default_factory=list)
    resource_usage: list[ResourceUsageRef] = Field(default_factory=list)
    crop_area_on_day: float | None = None


class PlanResponse(BaseModel):
    diagnostics: PlanDiagnostics
    assignment: PlanAssignment
    # Optional: event-level assignments (day x event -> workers)
    event_assignments: list[EventAssignment] | None = None
    # Objective values summary (evaluated on final plan when feasible)
    objectives: dict[str, float] = Field(default_factory=dict)
    # Lightweight numeric summaries to help quick inspection
    summary: dict[str, float] = Field(default_factory=dict)
    # Simple, human-readable hints when infeasible
    constraint_hints: list[str] = Field(default_factory=list)
