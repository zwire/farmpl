from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import require_auth
from schemas.optimization import ApiEvent, ApiPlan
from schemas.templates import CropCatalogItem, CropSuggestResponse, TemplateListItem
from services import template_instantiator as inst
from services import templates_loader as loader

router = APIRouter(
    prefix="/v1/templates", tags=["templates"], dependencies=[Depends(require_auth)]
)


@router.get("", response_model=list[TemplateListItem])
def list_templates() -> list[TemplateListItem]:
    return loader.list_items()


class InstantiateRequest(BaseModel):
    template_id: str
    start_date: date
    horizon_days: int
    price_per_a_override: float | None = None
    crop_id_override: str | None = None
    crop_name_override: str | None = None


@router.post("/instantiate", response_model=ApiPlan)
def instantiate_template(req: InstantiateRequest) -> ApiPlan:
    try:
        tpl = loader.get_by_id(req.template_id)
    except KeyError:
        raise HTTPException(status_code=404, detail={"message": "template not found"})
    opts = inst.InstantiateOptions(
        start_date=req.start_date,
        horizon_days=req.horizon_days,
        price_per_a_override=req.price_per_a_override,
        crop_id_override=req.crop_id_override,
        crop_name_override=req.crop_name_override,
    )
    return inst.instantiate(tpl, opts)


@router.get("/crops", response_model=list[CropCatalogItem])
def list_crops_catalog() -> list[CropCatalogItem]:
    return loader.build_catalog()


@router.get("/crops/suggest", response_model=CropSuggestResponse)
def suggest_crops(query: str, limit: int = 5) -> CropSuggestResponse:
    items = loader.suggest_crops(query, limit)
    return CropSuggestResponse(query=query, items=items)


class InstantiateEventsRequest(BaseModel):
    template_id: str
    start_date: date
    horizon_days: int
    target_crop_id: str


class InstantiateEventsResponse(BaseModel):
    events: list[ApiEvent]


@router.post("/instantiate-events", response_model=InstantiateEventsResponse)
def instantiate_events(req: InstantiateEventsRequest) -> InstantiateEventsResponse:
    try:
        tpl = loader.get_by_id(req.template_id)
    except KeyError:
        raise HTTPException(status_code=404, detail={"message": "template not found"})
    opts = inst.InstantiateOptions(
        start_date=req.start_date,
        horizon_days=req.horizon_days,
    )
    plan = inst.instantiate(tpl, opts)
    # Remap crop_id in events to the UI's target crop id
    out: list[ApiEvent] = []
    for e in plan.events:
        out.append(
            ApiEvent(
                id=e.id,
                crop_id=req.target_crop_id,
                name=e.name,
                category=e.category,
                start_cond=e.start_cond,
                end_cond=e.end_cond,
                frequency_days=e.frequency_days,
                preceding_event_id=e.preceding_event_id,
                lag_min_days=e.lag_min_days,
                lag_max_days=e.lag_max_days,
                people_required=e.people_required,
                labor_total_per_a=e.labor_total_per_a,
                labor_daily_cap=e.labor_daily_cap,
                required_roles=e.required_roles,
                required_resources=e.required_resources,
                uses_land=e.uses_land,
            )
        )
    return InstantiateEventsResponse(events=out)
