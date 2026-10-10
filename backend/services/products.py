import json
from functools import lru_cache
from pathlib import Path

from schemas import Product, ProductRecommendations, RoomRequest

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "products.json"
MAX_PER_CATEGORY = 2


class CatalogError(Exception):
    """The product catalog is missing or malformed."""


@lru_cache
def load_catalog(path: Path = CATALOG_PATH) -> tuple[Product, ...]:
    try:
        with path.open(encoding="utf-8") as f:
            products = tuple(Product(**item) for item in json.load(f))
    except (OSError, ValueError, TypeError) as exc:  # includes JSON and pydantic validation errors
        raise CatalogError(f"Could not load product catalog: {exc}") from exc
    ids = [p.id for p in products]
    if len(ids) != len(set(ids)):
        raise CatalogError("Product catalog contains duplicate ids.")
    return products


def recommend(req: RoomRequest) -> ProductRecommendations:
    """Greedy pick of sample products for the room and style, never exceeding the budget."""
    candidates = [p for p in load_catalog(CATALOG_PATH) if req.room_type in p.room_types and req.style in p.styles]
    # Room-specific products first, then pricier ones first (anchor pieces before accessories).
    candidates.sort(key=lambda p: (len(p.room_types), -p.price_inr))

    chosen: list[Product] = []
    per_category: dict[str, int] = {}
    total = 0
    for p in candidates:
        if per_category.get(p.category, 0) >= MAX_PER_CATEGORY:
            continue
        if total + p.price_inr <= req.budget_inr:
            chosen.append(p)
            per_category[p.category] = per_category.get(p.category, 0) + 1
            total += p.price_inr

    note = None
    if not candidates:
        note = "No sample products match this room type and style."
    elif not chosen:
        note = "Budget is below the cheapest matching sample product."
    return ProductRecommendations(
        items=chosen,
        total_inr=total,
        budget_inr=req.budget_inr,
        remaining_inr=req.budget_inr - total,
        note=note,
    )
