from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_auth
from schemas.optimization import ApiPlan
from schemas.templates import (
    CropCatalogItem,
    CropSuggestResponse,
    InstantiateEventsRequest,
    InstantiateEventsResponse,
    InstantiateRequest,
    TemplateListItem,
)
from services import template_instantiator as inst
from services import templates_loader as loader

router = APIRouter(
    prefix="/v1/templates", tags=["templates"], dependencies=[Depends(require_auth)]
)


@router.get("", response_model=list[TemplateListItem])
def list_templates() -> list[TemplateListItem]:
    return loader.list_items()


@router.post("/instantiate", response_model=ApiPlan)
def instantiate_template(req: InstantiateRequest) -> ApiPlan:
    try:
        tpl = loader.get_by_id(req.template_id)
    except KeyError as err:
        raise HTTPException(
            status_code=404, detail={"message": "template not found"}
        ) from err
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


@router.post("/instantiate-events", response_model=InstantiateEventsResponse)
def instantiate_events(req: InstantiateEventsRequest) -> InstantiateEventsResponse:
    try:
        tpl = loader.get_by_id(req.template_id)
    except KeyError as err:
        raise HTTPException(
            status_code=404, detail={"message": "template not found"}
        ) from err
    opts = inst.InstantiateOptions(
        start_date=req.start_date,
        horizon_days=req.horizon_days,
    )
    plan = inst.instantiate(tpl, opts)
    events = [
        event.model_copy(update={"crop_id": req.target_crop_id})
        for event in plan.events
    ]
    return InstantiateEventsResponse(events=events)
