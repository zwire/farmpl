from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.optimization import ApiEvent

"""Template schema for crop/event presets (Pydantic v2).

These models represent file-backed presets stored in TOML under
`api/templates/crops/**.toml`. They can be loaded and then instantiated
into strict `ApiPlan` objects with seasonal adjustments.
"""


# Event category must match UI EventCategory (planning-ui-types.ts)
EventCategoryLiteral = Literal[
    "圃場準備",
    "播種",
    "定植",
    "潅水",
    "施肥",
    "除草",
    "防除",
    "間引き",
    "整枝",
    "摘心",
    "収穫",
    "出荷",
    "片付け",
    "その他",
]


class TemplateEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: EventCategoryLiteral | None = None
    uses_land: bool = False
    # Either a start window (absolute from Day=1), or lag from predecessor
    start_window_days: tuple[int, int] | None = Field(default=None)
    preceding_event_id: str | None = None
    lag_days: tuple[int, int] | None = Field(default=None)
    frequency_days: int | None = Field(default=None, gt=0)
    labor_total_per_a: float | None = Field(default=None, ge=0)
    labor_daily_cap: float | None = Field(default=None, ge=0)
    people_required: int | None = Field(default=None, ge=0)
    required_roles: set[str] | None = None
    required_resources: set[str] | None = None


class CropTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # File-level template metadata
    id: str
    label: str
    # New style: template refers to external crop master by id
    # Loader fills the following for backward compatibility
    crop_id: str
    crop_name: str
    category: str | None = None
    variant: str | None = None
    price_per_a: float | None = Field(default=None, ge=0)
    price_per_10a: float | None = Field(default=None, ge=0)
    events: list[TemplateEvent] = Field(default_factory=list)

    @field_validator("price_per_a")
    @classmethod
    def _dummy_validator(cls, v: float | None):
        # Allow either price_per_a or price_per_10a; normalized later
        return v


class TemplateListItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    crop_id: str
    crop_name: str
    variant: str | None = None
    category: str | None = None
    default_horizon_days: int | None = None


class CropVariantItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    template_id: str
    label: str
    variant: str | None = None
    price_per_a: float | None = None


class CropCatalogItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_name: str
    category: str | None = None
    # Optional aliases for search (e.g., kana/kanji variants)
    aliases: list[str] = Field(default_factory=list)
    variants: list[CropVariantItem] = Field(default_factory=list)


class CropSuggestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    items: list[CropCatalogItem] = Field(default_factory=list)


class InstantiateRequest(BaseModel):
    template_id: str
    start_date: date
    horizon_days: int
    price_per_a_override: float | None = None
    crop_id_override: str | None = None
    crop_name_override: str | None = None


class InstantiateEventsRequest(BaseModel):
    template_id: str
    start_date: date
    horizon_days: int
    target_crop_id: str


class InstantiateEventsResponse(BaseModel):
    events: list[ApiEvent]
