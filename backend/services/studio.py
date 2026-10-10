"""Prices for the 3D Room Designer, computed from the verified product catalog.

data/studio_catalog.json says which verified products each designer item type can stand for (a
"sofa" shape can be a KIVIK or a KLIPPAN, never a lamp) and which budget category it belongs to.
The browser sends only item types and the product ids the user picked; every price, total and
budget figure is looked up and added up here. Items without a picked, verified product are listed
as unpriced and never count towards a total.
"""
import json
import logging
from functools import lru_cache
from pathlib import Path

from schemas import (
    StudioCatalog,
    StudioCategoryTotal,
    StudioLine,
    StudioPrice,
    StudioPriceRequest,
    StudioProduct,
    StudioSuggestion,
    StudioType,
)
from services import products as product_service

logger = logging.getLogger("spacesense.studio")

STUDIO_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "studio_catalog.json"
MAX_SUGGESTIONS = 4
SURFACE_CATEGORY = {"walls": "wall_finishes", "floor": "flooring"}


class StudioDesignError(ValueError):
    """The design refers to an item type or product the catalog doesn't allow."""

    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field


@lru_cache
def load_mapping(path: Path = STUDIO_CATALOG_PATH) -> dict:
    """The type → products mapping, checked for shape. Raises CatalogError if unusable."""
    try:
        with path.open(encoding="utf-8") as f:
            raw = json.load(f)
        categories = raw["budget_categories"]
        types = raw["types"]
        for name, spec in types.items():
            if spec["category"] not in categories:
                raise ValueError(f"type {name!r} has unknown category {spec['category']!r}")
            if not isinstance(spec["products"], list) or not all(isinstance(p, str) for p in spec["products"]):
                raise ValueError(f"type {name!r} products must be a list of ids")
        for surface, cat in SURFACE_CATEGORY.items():
            if cat not in categories:
                raise ValueError(f"budget category {cat!r} for {surface} is missing")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise product_service.CatalogError(f"Could not load the designer catalog: {exc}") from exc
    return raw


def _studio_product(p) -> StudioProduct:
    return StudioProduct(
        product_id=p.id, name=p.name, retailer=p.retailer, product_url=p.product_url, image_url=p.image_url,
        price_inr=p.price_inr, last_checked=p.last_checked, listed_size=p.dimensions,
        availability=p.availability, styles=p.styles,
    )


def studio_catalog() -> StudioCatalog:
    """Each designer type with the verified products it may stand for. Unverified ids are left out."""
    mapping = load_mapping(STUDIO_CATALOG_PATH)
    by_id = {p.id: p for p in product_service.load_catalog(product_service.CATALOG_PATH)}
    types = {}
    for name, spec in mapping["types"].items():
        found = []
        for pid in spec["products"]:
            p = by_id.get(pid)
            if p is None or p.price_status != "verified":
                logger.warning("Designer type %s: product %s is missing or not verified; skipped", name, pid)
                continue
            found.append(_studio_product(p))
        types[name] = StudioType(category=spec["category"], products=found)
    return StudioCatalog(
        budget_categories=mapping["budget_categories"], types=types, excluded_costs=product_service.EXCLUDED_COSTS,
    )


def price_design(req: StudioPriceRequest) -> StudioPrice:
    catalog = studio_catalog()
    mapping = load_mapping(STUDIO_CATALOG_PATH)
    lines: list[StudioLine] = []

    for i, item in enumerate(req.items):
        kind = catalog.types.get(item.type)
        if kind is None:
            raise StudioDesignError(f"items.{i}.type", f"unknown item type {item.type!r}")
        products = {p.product_id: p for p in kind.products}
        label = item.label or item.type.replace("-", " ").capitalize()
        if item.product_id is None:
            reason = "generic" if products else "no_products"
            lines.append(StudioLine(uid=item.uid, type=item.type, label=label, category=kind.category,
                                    product=None, price_inr=None, price_status="unavailable", reason=reason))
        elif item.product_id in products:
            p = products[item.product_id]
            lines.append(StudioLine(uid=item.uid, type=item.type, label=label, category=kind.category,
                                    product=p, price_inr=p.price_inr, price_status="verified"))
        elif item.product_id in mapping["types"][item.type]["products"]:
            # Allowed for this type, but no longer verified in the catalog: never priced.
            lines.append(StudioLine(uid=item.uid, type=item.type, label=label, category=kind.category,
                                    product=None, price_inr=None, price_status="unavailable", reason="unverified"))
        else:
            raise StudioDesignError(f"items.{i}.product_id", f"{item.product_id!r} is not a product for {item.type!r}")

    for s in req.surfaces:
        lines.append(StudioLine(uid=None, type=s.id, label=s.label, category=SURFACE_CATEGORY[s.id],
                                product=None, price_inr=None, price_status="unavailable", reason="finish"))

    total = sum(line.price_inr for line in lines if line.price_inr is not None)
    categories = []
    for cid, clabel in catalog.budget_categories.items():
        in_cat = [line for line in lines if line.category == cid]
        priced = [line for line in in_cat if line.price_inr is not None]
        categories.append(StudioCategoryTotal(
            id=cid, label=clabel, total_inr=sum(line.price_inr for line in priced),
            priced_count=len(priced), unpriced_count=len(in_cat) - len(priced),
        ))

    budget = req.budget_inr
    remaining = budget - total
    return StudioPrice(
        budget_inr=budget,
        total_inr=total,
        remaining_inr=remaining,
        over_budget_inr=-remaining if remaining < 0 else None,
        used_ratio=round(total / budget, 4) if budget > 0 else None,
        unpriced_count=sum(1 for line in lines if line.price_inr is None),
        categories=categories,
        lines=lines,
        suggestions=_suggestions(catalog, req, remaining),
        excluded_costs=catalog.excluded_costs,
    )


def _suggestions(catalog: StudioCatalog, req: StudioPriceRequest, remaining: float) -> list[StudioSuggestion]:
    """Verified products that fit the remaining budget, the chosen style first and unplaced types
    first. Suggestions only; nothing in the design is changed or replaced."""
    if remaining <= 0:
        return []
    placed_types = {i.type for i in req.items}
    picked = {i.product_id for i in req.items if i.product_id}
    candidates = [
        (name, p) for name, t in catalog.types.items() for p in t.products
        if p.price_inr <= remaining and p.product_id not in picked and p.availability != "out_of_stock"
    ]
    candidates.sort(key=lambda c: (
        req.style is not None and req.style not in c[1].styles,  # style match first
        c[0] in placed_types,  # something new for the room first
        -c[1].price_inr,  # then the fullest use of the budget
        c[1].product_id,
    ))
    out, seen_types = [], set()
    for name, p in candidates:
        if name in seen_types:
            continue
        seen_types.add(name)
        out.append(StudioSuggestion(type=name, product=p))
        if len(out) == MAX_SUGGESTIONS:
            break
    return out
