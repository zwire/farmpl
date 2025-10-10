from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.optimization import ApiEvent

"""Template schema for crop/event presets (Pydantic v2).

These models represent file-backed presets stored in TOML under
`api/templates/crops/**.toml`. They can be loaded and then instantiated
into strict `ApiPlan` objects with seasonal adjustments.
"""


class SeasonalConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    default: float = Field(1.0, ge=0.1, le=3.0)
    # keys as month numbers in string form ("1".."12") to make TOML maps predictable
    coeff_by_month: dict[str, float] = Field(default_factory=dict)

    @field_validator("coeff_by_month")
    @classmethod
    def _check_month_keys(cls, v: dict[str, float]):
        for k, val in v.items():
            if k not in {str(i) for i in range(1, 13)}:
                raise ValueError("coeff_by_month keys must be '1'..'12'")
            if not (0.1 <= float(val) <= 3.0):
                raise ValueError("coeff_by_month values must be within 0.1..3.0")
        return v

    def factor_for(self, d: date) -> float:
        return float(self.coeff_by_month.get(str(d.month), self.default))


class HorizonHint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    default_days: int | None = Field(default=None, gt=0)


class TemplateEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: str | None = None
    uses_land: bool = False
    # Either a start window (absolute from Day=1), or lag from predecessor
    start_window_days: tuple[int, int] | None = Field(default=None)
    preceding_event_id: str | None = None
    lag_days: tuple[int, int] | None = Field(default=None)
    frequency_days: int | None = Field(default=None, gt=0)
    # Seasonal scaling (per event). When true, seasonal factor applies to lag days.
    # Start windows are not scaled by default.
    seasonal_scale: bool = True
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
    crop_id: str
    crop_name: str
    category: str | None = None
    variant: str | None = None
    price_per_a: float | None = Field(default=None, ge=0)
    price_per_10a: float | None = Field(default=None, ge=0)
    seasonal: SeasonalConfig = Field(default_factory=SeasonalConfig)
    horizon_hint: HorizonHint = Field(default_factory=HorizonHint)
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
    default_horizon_days: int | None = None


class CropCatalogItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_name: str
    category: str | None = None
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
