"""Product recommendations: relevance, the in-budget plan and the product-source boundary.

Sources return `Product`s; this module ranks them for the room, picks an in-budget plan and
computes every total in code. Only verified prices are ever summed. Suggestions without a
verified product page get retailer *search* links built from their search query, clearly
labelled as such.

Sources are chosen with SPACESENSE_PRODUCT_PROVIDER:
  catalog  (default) the curated local catalog in data/products.json
  serpapi  live Google Shopping results via SerpAPI (needs SERPAPI_API_KEY), then the catalog
The local catalog is always used, so recommendations keep working when a live source fails.
"""
import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Protocol
from urllib.parse import quote_plus

from config import RETAILER_SEARCH_URLS
from schemas import (
    Product,
    ProductRecommendation,
    ProductRecommendations,
    ProductRequest,
    RetailerLink,
    retailer_for_url,  # noqa: F401 - re-exported for tools/refresh_catalog.py
)

logger = logging.getLogger("spacesense.products")

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "products.json"
ALTERNATIVES_PER_CATEGORY = 2
MAX_ITEMS = 24

EXCLUDED_COSTS = (
    "Delivery, assembly and installation charges are not included. Prices are the retailer's listed "
    "price on the date shown and can change; confirm the final price on the retailer's page."
)

# Most useful categories first for each room.
ROOM_CATEGORIES = {
    "living room": ["seating", "tables", "rugs", "lighting", "curtains", "storage", "decor"],
    "bedroom": ["beds", "storage", "curtains", "lighting", "tables", "rugs", "decor"],
    "kitchen": ["storage", "lighting", "seating", "tables", "decor"],
    "dining room": ["tables", "seating", "lighting", "rugs", "curtains", "decor"],
    "home office": ["tables", "seating", "lighting", "storage", "curtains", "decor"],
    "kids room": ["beds", "storage", "tables", "lighting", "rugs", "curtains", "decor"],
}

# Words in the design advice that point at a category.
CATEGORY_KEYWORDS = {
    "seating": ("sofa", "couch", "armchair", "chair", "chairs", "seating", "stool", "loveseat"),
    "tables": ("table", "desk", "console"),
    "beds": ("bed", "headboard"),
    "storage": ("storage", "shelf", "shelves", "shelving", "bookcase", "cabinet", "wardrobe", "drawers",
                "chest", "sideboard", "tv unit", "rack", "trolley"),
    "lighting": ("lamp", "lamps", "lighting", "pendant", "sconce", "chandelier"),
    "rugs": ("rug", "rugs", "carpet", "dhurrie"),
    "curtains": ("curtain", "curtains", "drapes", "blinds", "sheers"),
    "decor": ("mirror", "artwork", "frame", "frames", "plant", "plants", "cushion", "cushions", "vase",
              "wall hanging"),
}

# Rough share of the budget each category deserves: anchor pieces get more than accessories.
# Shares are normalised over the categories actually wanted for the room.
BUDGET_WEIGHTS = {"seating": 30, "beds": 30, "tables": 15, "storage": 15, "lighting": 7, "rugs": 7,
                  "curtains": 5, "decor": 3}

VASTU_NOTES = {
    "mirror": "Vastu: avoid hanging a mirror facing the main entrance or the bed.",
    "heavy": "Vastu: heavy pieces are usually placed along the south or west walls.",
}


class CatalogError(Exception):
    """The product catalog is missing or malformed."""


class ProductSourceError(Exception):
    """A live product source failed. The message is for logs only."""


class ProductSource(Protocol):
    name: str

    def find(self, req: ProductRequest, categories: list[str]) -> list[Product]: ...


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


class CatalogSource:
    name = "local_catalog"

    def find(self, req: ProductRequest, categories: list[str]) -> list[Product]:
        return [p for p in load_catalog(CATALOG_PATH) if req.room_type in p.room_types and p.category in categories]


def _serpapi_source() -> ProductSource:
    from services.providers import ProviderConfigError
    from services.shopping import SerpApiShopping

    key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not key:
        raise ProviderConfigError("SPACESENSE_PRODUCT_PROVIDER=serpapi requires SERPAPI_API_KEY in backend/.env.")
    return SerpApiShopping(key)


LIVE_SOURCES = {"serpapi": _serpapi_source}


@lru_cache
def get_product_sources() -> tuple[ProductSource, ...]:
    """Live source first (if configured), then the local catalog, which is always used."""
    name = os.getenv("SPACESENSE_PRODUCT_PROVIDER", "catalog").strip().lower()
    if name == "catalog":
        return (CatalogSource(),)
    if name not in LIVE_SOURCES:
        from services.providers import ProviderConfigError

        raise ProviderConfigError(f"Unknown SPACESENSE_PRODUCT_PROVIDER {name!r}; use catalog or {', '.join(LIVE_SOURCES)}.")
    return (LIVE_SOURCES[name](), CatalogSource())


# --- relevance ---------------------------------------------------------------------------------
def _mentions(texts: list[str]) -> list[str]:
    """Categories mentioned in free text, in order of first mention."""
    text = " ".join(texts).lower()
    found: dict[str, int] = {}
    for category, words in CATEGORY_KEYWORDS.items():
        positions = [m.start() for w in words for m in re.finditer(rf"\b{re.escape(w)}\b", text)]
        if positions:
            found[category] = min(positions)
    return sorted(found, key=found.get)


def wanted_categories(req: ProductRequest) -> list[str]:
    """The explicit filter if given; otherwise the room's categories, reordered by the design advice.

    Categories the advice says to replace or add come first. Categories mentioned only under
    "keep" are dropped, so we don't suggest a new sofa when the advice is to keep the sofa.
    """
    if req.categories:
        return list(dict.fromkeys(req.categories))
    base = ROOM_CATEGORIES[req.room_type]
    recs = req.recommendations
    if recs is None:
        return list(base)
    wanted = _mentions(recs.replace + recs.decor + recs.lighting + recs.layout)
    kept = set(_mentions(recs.keep)) - set(wanted)
    return [c for c in dict.fromkeys(wanted + base) if c not in kept]


def matched_colors(product: Product, color_text: str) -> list[str]:
    """Product colours with a word that appears in the recommended palette text."""
    if not color_text:
        return []
    return [
        c for c in product.colors
        if any(re.search(rf"\b{re.escape(w)}\b", color_text) for w in re.split(r"[\s-]+", c.lower()) if len(w) > 2)
    ]


def search_links(query: str) -> list[RetailerLink]:
    return [
        RetailerLink(retailer=name, url=template.format(q=quote_plus(query)), kind="search")
        for name, template in RETAILER_SEARCH_URLS.items()
    ]


def line_total(p: Product) -> int | None:
    return p.price_inr * p.quantity if p.price_status == "verified" else None


def _notes(product: Product, req: ProductRequest) -> list[str]:
    notes = []
    if req.style not in product.styles:
        style = req.style.replace("-", " ")
        article = "an" if style[0] in "aeiou" else "a"
        notes.append(f"Not specifically {article} {style} piece; the closest match we have.")
    if product.availability == "out_of_stock":
        notes.append("Listed as out of stock when last checked.")
    if req.vastu:
        name = product.name.lower()
        if "mirror" in name:
            notes.append(VASTU_NOTES["mirror"])
        elif product.category in ("beds", "storage") or "sofa" in name or "wardrobe" in name:
            notes.append(VASTU_NOTES["heavy"])
    return notes


def _to_item(product: Product, req: ProductRequest, color_text: str, selected: bool) -> ProductRecommendation:
    if product.product_url:
        links = [RetailerLink(retailer=product.retailer, url=product.product_url, kind="product")]
    else:
        links = search_links(product.search_query)
    return ProductRecommendation(
        **product.model_dump(),
        kind="verified_product" if product.price_status == "verified" else "suggestion",
        selected=selected,
        line_total_inr=line_total(product),
        links=links,
        matched_colors=matched_colors(product, color_text),
        notes=_notes(product, req),
    )


# --- the plan ----------------------------------------------------------------------------------
def _best(buyable: list[Product], score) -> list[Product]:
    """The products with the highest relevance score."""
    if not buyable:
        return []
    best = max(score(p) for p in buyable)
    return [p for p in buyable if score(p) == best]


def build_plan(req: ProductRequest, products: list[Product], sources: list[str], notices: list[str]) -> ProductRecommendations:
    """Rank products per category and select at most one per category within the budget.

    Pass 1 gives each category its share of the budget (BUDGET_WEIGHTS) and takes the priciest
    best-matching piece within that share, so money goes to a proper sofa or bed rather than
    the cheapest accessory. Pass 2 spends what's left on the categories still empty, in
    priority order, taking the cheapest best-matching piece that fits.
    """
    categories = wanted_categories(req)
    color_text = " ".join(req.recommendations.colors).lower() if req.recommendations else ""

    def score(p: Product) -> int:
        return 3 * (req.style in p.styles) + len(matched_colors(p, color_text))

    by_category: dict[str, list[Product]] = {c: [] for c in categories}
    seen_urls: set[str] = set()
    for p in products:
        if p.category not in by_category or req.room_type not in p.room_types:
            continue
        if p.product_url:
            if p.product_url in seen_urls:  # a live result that is also in the catalog
                continue
            seen_urls.add(p.product_url)
        by_category[p.category].append(p)

    styled: dict[str, list[Product]] = {}
    buyable: dict[str, list[Product]] = {}
    for category in categories:
        # Prefer pieces in the chosen style; fall back to others only if the category has none.
        styled[category] = [p for p in by_category[category] if req.style in p.styles] or by_category[category]
        buyable[category] = sorted(
            (p for p in styled[category] if p.price_status == "verified" and p.availability != "out_of_stock"),
            key=lambda p: (-score(p), line_total(p)),
        )

    picks: dict[str, Product] = {}
    remaining = req.budget_inr
    total_weight = sum(BUDGET_WEIGHTS[c] for c in categories) or 1
    for category in categories:  # pass 1: within each category's share
        share = min(req.budget_inr * BUDGET_WEIGHTS[category] / total_weight, remaining)
        within = [p for p in _best(buyable[category], score) if line_total(p) <= share]
        if within:
            picks[category] = max(within, key=line_total)
            remaining -= line_total(picks[category])
    for category in categories:  # pass 2: leftover budget, cheapest that fits
        if category in picks:
            continue
        fits = [p for p in buyable[category] if line_total(p) <= remaining]
        if fits:
            picks[category] = min(_best(fits, score), key=line_total)
            remaining -= line_total(picks[category])

    selected = [picks[c] for c in categories if c in picks]
    alternatives: list[Product] = []
    suggestions: list[Product] = []
    for category in categories:
        pick = picks.get(category)
        rest = [p for p in buyable[category] if p is not pick]
        if pick is None:  # nothing fits: show the cheapest options first
            rest.sort(key=line_total)
        alternatives.extend(rest[:ALTERNATIVES_PER_CATEGORY])
        unpriced = sorted((p for p in styled[category] if p not in buyable[category]), key=lambda p: -score(p))
        suggestions.extend(unpriced[:1])

    total = sum(line_total(p) for p in selected)
    items = [_to_item(p, req, color_text, True) for p in selected]
    items += [_to_item(p, req, color_text, False) for p in alternatives + suggestions]
    items = items[:MAX_ITEMS]

    buyable_all = [p for pool in by_category.values() for p in pool
                   if p.price_status == "verified" and p.availability != "out_of_stock"]
    shortfall = None
    note = None
    if not items:
        note = "No products in our sources match this room type and category selection."
    elif not selected and buyable_all:
        cheapest = min(buyable_all, key=line_total)
        shortfall = line_total(cheapest) - int(req.budget_inr)
        note = (
            f"Your budget of ₹{req.budget_inr:,.0f} is below the cheapest matching verified product "
            f"({cheapest.name}, ₹{line_total(cheapest):,}), so nothing is selected. The lowest-priced options are "
            "listed first: you could raise the budget, buy fewer pieces, or use the retailer search links to find cheaper ones."
        )
    elif not selected:
        note = "We have no verified prices for this selection, so nothing counts towards your budget. Use the retailer search links to compare prices."
    else:
        covered = {p.category for p in selected}
        missing = [c for c in categories if c not in covered and any(p in buyable_all for p in by_category[c])]
        if missing:
            note = (
                f"The budget covers {len(covered)} of {len(covered) + len(missing)} categories with verified prices. "
                f"Options for {', '.join(missing)} are listed unselected because adding them would exceed the budget."
            )

    return ProductRecommendations(
        sources=sources,
        items=items,
        budget_inr=req.budget_inr,
        total_inr=total,
        remaining_inr=req.budget_inr - total,
        unpriced_count=sum(1 for i in items if i.line_total_inr is None),
        shortfall_inr=shortfall,
        excluded_costs=EXCLUDED_COSTS,
        note=note,
        notices=notices,
    )


def recommend(req: ProductRequest) -> ProductRecommendations:
    categories = wanted_categories(req)
    products: list[Product] = []
    sources: list[str] = []
    notices: list[str] = []
    for source in get_product_sources():
        try:
            found = source.find(req, categories)
        except ProductSourceError as exc:
            logger.warning("Product source %s failed: %s", source.name, exc)
            notices.append("Live product search is unavailable right now, so these come from the SpaceSense catalog.")
            continue
        if found:
            sources.append(source.name)
            products.extend(found)
    return build_plan(req, products, sources, notices)
