from __future__ import annotations

import tomllib
from collections.abc import Iterable
from dataclasses import dataclass
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
CROP_CATALOG_FILE = ROOT / "templates" / "catalog" / "crops.toml"
_CACHE: list[LoadedTemplate] | None = None


@dataclass(frozen=True)
class LoadedTemplate:
    path: Path
    data: CropTemplate


def _load_crop_catalog() -> dict[str, dict[str, object]]:
    """Load crop masters from catalog file.

    Returns a mapping: crop_id -> {"name": str, "category": str|None, "aliases": list[str]}
    """
    if not CROP_CATALOG_FILE.exists():
        return {}
    with CROP_CATALOG_FILE.open("rb") as f:
        raw = tomllib.load(f)
    crops = raw.get("crops") or []
    out: dict[str, dict[str, object]] = {}
    for item in crops:
        cid = str(item.get("id") or "").strip()
        if not cid:
            continue
        aliases_raw = item.get("aliases") or []
        aliases: list[str] = []
        if isinstance(aliases_raw, list):
            for a in aliases_raw:
                s = str(a or "").strip()
                if s:
                    aliases.append(s)
        out[cid] = {
            "name": str(item.get("name") or "").strip() or cid,
            "category": (str(item.get("category")) if item.get("category") else None),
            "aliases": aliases,
        }
    return out


def _iter_template_files() -> Iterable[Path]:
    if not TEMPLATES_DIR.exists():
        return []
    yield from TEMPLATES_DIR.rglob("*.toml")


def load_all() -> list[LoadedTemplate]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    out: list[LoadedTemplate] = []
    crops = _load_crop_catalog()
    for p in sorted(_iter_template_files()):
        try:
            with p.open("rb") as f:
                raw = tomllib.load(f)
            tpl = dict(raw.get("template") or {})
            # New style: `crop_ref` field points to catalog id
            crop_ref = tpl.pop("crop_ref", None) or tpl.get("crop_id")
            crop_id = str(crop_ref) if crop_ref is not None else None
            crop_name = None
            category = tpl.get("category")
            if crop_id and crop_id in crops:
                crop_name = crops[crop_id]["name"]
                if category is None:
                    category = crops[crop_id]["category"]
            # Fallback to legacy fields if provided in file
            crop_id = crop_id or (tpl.get("crop_id") or "").strip() or None
            crop_name = crop_name or (tpl.get("crop_name") or "").strip() or None
            if not crop_id or not crop_name:
                raise ValueError(
                    "template must define crop_ref (or crop_id/crop_name legacy)"
                )

            normalized = {
                **tpl,
                "crop_id": crop_id,
                "crop_name": crop_name,
                "category": category,
                "events": raw.get("events", []),
                "horizon_hint": raw.get("horizon_hint", {}),
            }
            data = CropTemplate.model_validate(normalized)
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
    crop_master = _load_crop_catalog()
    for lt in load_all():
        key = (lt.data.crop_name, lt.data.category)
        groups.setdefault(key, []).append(lt)
    items: list[CropCatalogItem] = []
    for (crop_name, category), templates in sorted(groups.items()):
        # Determine crop_id(s) in this group (should typically be one)
        crop_ids = {lt.data.crop_id for lt in templates}
        # Pick one (groups should not mix different crop_ids, but just in case)
        any_crop_id = next(iter(crop_ids)) if crop_ids else None
        aliases: list[str] = []
        if any_crop_id and any_crop_id in crop_master:
            aliases = list(crop_master[any_crop_id].get("aliases", []))  # type: ignore[assignment]
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
            CropCatalogItem(
                crop_name=crop_name,
                category=category,
                aliases=aliases,
                variants=variants,
            )
        )
    return items


def suggest_crops(query: str, limit: int = 5) -> list[CropCatalogItem]:
    """Suggest crops strictly related to the given name/alias.

    - If `query` matches a crop name or one of its aliases (case-insensitive),
      return only the catalog items for that crop (all variants/categories).
    - If `query` is empty, return first `limit` items as a fallback.
    - Avoid fuzzy matching based on string similarity.
    """
    catalog = build_catalog()
    q = query.strip()
    if not q:
        return catalog[:limit]

    q_lower = q.lower()
    # First try exact name match (case-insensitive)
    matched_by_name = [it for it in catalog if it.crop_name.lower() == q_lower]
    if matched_by_name:
        return matched_by_name

    # Then try alias match
    matched_by_alias = [
        it for it in catalog if any(a.lower() == q_lower for a in (it.aliases or []))
    ]
    if matched_by_alias:
        return matched_by_alias

    # No match: return empty list (explicitly avoid fuzzy suggestions)
    return []
