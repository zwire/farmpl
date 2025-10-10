from __future__ import annotations

import tomllib
from collections.abc import Iterable
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from schemas.templates import (
    CropCatalogItem,
    CropTemplate,
    CropVariantItem,
    TemplateListItem,
)

"""Load crop/event templates from TOML files.

Scans `api/templates/crops/**.toml`, validates with Pydantic models, and exposes
metadata for listing as well as full templates for instantiation.
"""

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates" / "crops"
_CACHE: list[LoadedTemplate] | None = None


@dataclass(frozen=True)
class LoadedTemplate:
    path: Path
    data: CropTemplate


def _iter_template_files() -> Iterable[Path]:
    if not TEMPLATES_DIR.exists():
        return []
    yield from TEMPLATES_DIR.rglob("*.toml")


def load_all() -> list[LoadedTemplate]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    out: list[LoadedTemplate] = []
    for p in sorted(_iter_template_files()):
        try:
            with p.open("rb") as f:
                raw = tomllib.load(f)
            data = CropTemplate.model_validate(
                raw.get("template")
                | {
                    "events": raw.get("events", []),
                    "seasonal": raw.get("seasonal", {}),
                    "horizon_hint": raw.get("horizon_hint", {}),
                }
            )
            out.append(LoadedTemplate(path=p, data=data))
        except Exception as e:
            raise RuntimeError(f"Failed to load template: {p}: {e}") from e
    _CACHE = out
    return out


def reset_cache() -> None:
    global _CACHE
    _CACHE = None


def list_items() -> list[TemplateListItem]:
    items: list[TemplateListItem] = []
    for lt in load_all():
        items.append(
            TemplateListItem(
                id=lt.data.id,
                label=lt.data.label,
                crop_id=lt.data.crop_id,
                crop_name=lt.data.crop_name,
                variant=lt.data.variant,
                category=lt.data.category,
                default_horizon_days=lt.data.horizon_hint.default_days,
            )
        )
    return items


def get_by_id(template_id: str) -> CropTemplate:
    for lt in load_all():
        if lt.data.id == template_id:
            return lt.data
    raise KeyError(template_id)


def build_catalog() -> list[CropCatalogItem]:
    groups: dict[tuple[str, str | None], list[LoadedTemplate]] = {}
    for lt in load_all():
        key = (lt.data.crop_name, lt.data.category)
        groups.setdefault(key, []).append(lt)
    items: list[CropCatalogItem] = []
    for (crop_name, category), templates in sorted(groups.items()):
        variants: list[CropVariantItem] = []
        for lt in templates:
            variants.append(
                CropVariantItem(
                    template_id=lt.data.id,
                    label=lt.data.label,
                    variant=lt.data.variant,
                    price_per_a=lt.data.price_per_a
                    if lt.data.price_per_a is not None
                    else (lt.data.price_per_10a or 0.0) / 10.0,
                    default_horizon_days=lt.data.horizon_hint.default_days,
                )
            )
        items.append(
            CropCatalogItem(crop_name=crop_name, category=category, variants=variants)
        )
    return items


def suggest_crops(query: str, limit: int = 5) -> list[CropCatalogItem]:
    catalog = build_catalog()
    if not query.strip():
        return catalog[:limit]
    scored: list[tuple[float, CropCatalogItem]] = []
    q = query.strip().lower()
    for item in catalog:
        name = item.crop_name.lower()
        score = SequenceMatcher(None, q, name).ratio()
        scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]
