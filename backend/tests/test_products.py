import json
from datetime import date

import pytest
from pydantic import ValidationError

import main
from schemas import Product, ProductRequest
from services import products, providers
from services.products import ProductSourceError, build_plan, recommend, wanted_categories
from services.shopping import SerpApiShopping
from tests.conftest import VALID, idea, verified


def req(**overrides) -> ProductRequest:
    return ProductRequest(**{**VALID, **overrides})


def plan(items, **overrides):
    return build_plan(req(**overrides), [Product(**i) for i in items], ["test"], [])


def selected_ids(result):
    return [i.id for i in result.items if i.selected]


# --- relevance and category filtering ---
def test_only_matching_room_types_are_returned(client):
    data = client.post("/recommend-products", json=VALID).json()
    assert "desk" not in {i["id"] for i in data["items"]}
    assert all("living room" in i["room_types"] for i in data["items"])


def test_category_filter(client):
    data = client.post("/recommend-products", json={**VALID, "categories": ["lighting"]}).json()
    assert [i["id"] for i in data["items"]] == ["lamp"]


def test_unknown_category_rejected(client):
    r = client.post("/recommend-products", json={**VALID, "categories": ["spaceships"]})
    assert r.status_code == 422 and r.json()["details"][0]["field"] == "categories"


def test_unknown_request_field_rejected(client):
    assert client.post("/recommend-products", json={**VALID, "price_override": 1}).status_code == 422


def test_design_advice_reorders_and_keep_drops_categories():
    recs = {"replace": ["Swap the ceiling light for a warm floor lamp", "Add a jute rug"],
            "keep": ["Keep the sofa, it is in good shape"]}
    cats = wanted_categories(req(recommendations=recs))
    assert cats[:2] == ["lighting", "rugs"]
    assert "seating" not in cats


def test_replace_wins_over_keep():
    recs = {"replace": ["Replace the old sofa"], "keep": ["Keep the sofa frame colour in mind"]}
    assert "seating" in wanted_categories(req(recommendations=recs))


def test_style_match_preferred_over_cheaper_off_style():
    result = plan([verified("cheap-boho", "tables", 1000, styles=("boho",)), verified("scandi", "tables", 5000)])
    assert selected_ids(result) == ["scandi"]


def test_off_style_used_only_when_nothing_matches_and_is_labelled():
    result = plan([verified("boho-table", "tables", 1000, styles=("boho",))])
    item = result.items[0]
    assert item.selected and any("Not specifically" in n for n in item.notes)


def test_palette_colours_are_matched():
    recs = {"colors": ["Light grey walls with oak accents"]}
    result = plan([verified("sofa", "seating", 30000, colors=["light grey"])], recommendations=recs)
    assert result.items[0].matched_colors == ["light grey"]


# --- budget ---
def test_quantity_multiplies_line_total():
    result = plan([verified("chair", "seating", 2950, quantity=4)], budget_inr=20000)
    assert result.items[0].line_total_inr == 11800 and result.total_inr == 11800
    assert result.remaining_inr == 20000 - 11800


def test_one_pick_per_category_with_alternatives_unselected():
    items = [verified("a", "seating", 9000), verified("b", "seating", 8000), verified("c", "seating", 7000),
             verified("d", "seating", 6000)]
    result = plan(items, budget_inr=50000)
    assert sum(i.selected for i in result.items) == 1
    assert len(result.items) == 1 + products.ALTERNATIVES_PER_CATEGORY


def test_over_budget_lists_cheapest_first_with_shortfall():
    result = plan([verified("big", "seating", 30000), verified("small", "seating", 12000)], budget_inr=10000)
    assert result.total_inr == 0 and not selected_ids(result)
    assert [i.id for i in result.items] == ["small", "big"]
    assert result.shortfall_inr == 2000 and "below the cheapest" in result.note


def test_anchor_pieces_use_their_budget_share():
    items = [verified("stool", "seating", 3000), verified("sofa", "seating", 25000), verified("lamp", "lighting", 2000)]
    assert set(selected_ids(plan(items, budget_inr=80000, categories=["seating", "lighting"]))) == {"sofa", "lamp"}


def test_leftover_budget_fills_empty_categories_cheapest_first():
    items = [verified("bed", "beds", 14000, rooms=("bedroom",)), verified("curtain", "curtains", 4000, rooms=("bedroom",)),
             verified("wardrobe", "storage", 10000, rooms=("bedroom",))]
    result = plan(items, room_type="bedroom", budget_inr=20000)
    assert set(selected_ids(result)) == {"bed", "curtain"} and result.total_inr == 18000


def test_partial_coverage_note():
    result = plan([verified("sofa", "seating", 30000), verified("lamp", "lighting", 4000)], budget_inr=31000)
    assert selected_ids(result) == ["sofa"]
    assert "lighting" in result.note and result.remaining_inr == 1000


def test_budget_never_exceeded_with_real_catalog():
    products.load_catalog.cache_clear()
    for room in ("living room", "bedroom", "kitchen", "dining room", "home office", "kids room"):
        for budget in (0, 500, 5000, 25000, 75000, 300000):
            result = recommend(req(room_type=room, budget_inr=budget))
            chosen = [i for i in result.items if i.selected]
            assert result.total_inr == sum(i.line_total_inr for i in chosen) <= budget
            assert len({i.category for i in chosen}) == len(chosen)


# --- missing / unverified prices ---
def test_unpriced_suggestions_never_count_and_get_search_links():
    result = plan([idea("dhurrie", "rugs"), verified("lamp", "lighting", 4000)])
    rug = next(i for i in result.items if i.id == "dhurrie")
    assert rug.kind == "suggestion" and not rug.selected and rug.price_inr is None and rug.line_total_inr is None
    assert result.total_inr == 4000 and result.unpriced_count == 1
    assert rug.links and all(link.kind == "search" for link in rug.links)
    assert "dhurrie+search" in rug.links[0].url


def test_only_unpriced_items_explained():
    result = plan([idea("dhurrie", "rugs")])
    assert result.total_inr == 0 and "no verified prices" in result.note


def test_out_of_stock_is_never_selected():
    result = plan([verified("lamp", "lighting", 4000, availability="out_of_stock")])
    assert not selected_ids(result) and "out of stock" in result.items[0].notes[0]


def test_excluded_costs_always_stated(client):
    data = client.post("/recommend-products", json=VALID).json()
    assert "Delivery" in data["excluded_costs"] and data["currency"] == "INR"


# --- URLs and fabricated details ---
@pytest.mark.parametrize("bad", [
    {"product_url": "https://evil.example.com/sofa"},                     # not a supported retailer
    {"product_url": "http://www.ikea.com/in/en/p/sofa/"},                  # not https
    {"product_url": "https://ikea.com.evil.io/p/sofa"},                    # lookalike host
    {"retailer": "Amazon India"},                                          # retailer doesn't own the URL
    {"product_url": None},                                                 # verified but no product page
    {"last_checked": None},                                                # verified but never checked
    {"price_inr": None},                                                   # verified without a price
    {"price_inr": 0},
    {"image_url": "http://www.ikea.com/x.jpg"},
    {"category": "spaceships"},
])
def test_invalid_verified_products_rejected(bad):
    with pytest.raises(ValidationError):
        Product(**{**verified("sofa", "seating", 30000), **bad})


@pytest.mark.parametrize("invented", [{"price_inr": 9999}, {"availability": "in_stock"},
                                      {"image_url": "https://www.ikea.com/x.jpg"}])
def test_unverified_products_cannot_carry_prices_images_or_stock(invented):
    with pytest.raises(ValidationError):
        Product(**{**idea("rug", "rugs"), **invented})


def test_suggestion_without_url_needs_search_query():
    with pytest.raises(ValidationError):
        Product(**{**idea("rug", "rugs"), "search_query": None})


def test_unknown_fields_rejected():
    with pytest.raises(ValidationError):
        Product(**{**verified("sofa", "seating", 30000), "rating": 4.9})


def test_verified_item_links_to_its_product_page_only():
    item = plan([verified("lamp", "lighting", 4000)]).items[0]
    assert item.kind == "verified_product"
    assert [(link.kind, link.url) for link in item.links] == [("product", "https://www.ikea.com/in/en/p/lamp-0001/")]


def test_real_catalog_is_honest():
    products.load_catalog.cache_clear()
    catalog = products.load_catalog(products.CATALOG_PATH)
    verified_items = [p for p in catalog if p.price_status == "verified"]
    assert len(verified_items) >= 30
    for p in verified_items:
        assert p.product_url.startswith("https://www.ikea.com/in/en/p/") and p.last_checked and p.image_url
    for p in catalog:
        if p.price_status != "verified":
            assert p.price_inr is None and p.product_url is None and p.image_url is None and p.search_query
    for room, categories in products.ROOM_CATEGORIES.items():
        for category in categories:
            assert any(room in p.room_types and p.category == category for p in catalog), (room, category)


# --- vastu ---
def test_vastu_notes_only_when_requested():
    items = [verified("hovet-mirror", "decor", 5000), verified("wardrobe", "storage", 9000)]
    on = {i.id: i.notes for i in plan(items, vastu=True).items}
    assert "mirror" in on["hovet-mirror"][0] and "south or west" in on["wardrobe"][0]
    assert all(not i.notes for i in plan(items, vastu=False).items)


# --- product sources and failures ---
class FailingSource:
    name = "flaky"

    def find(self, *_):
        raise ProductSourceError("connection reset")


class FixedSource:
    name = "fixed"

    def __init__(self, items):
        self.items = items

    def find(self, *_):
        return self.items


def test_live_source_failure_falls_back_to_catalog(client, monkeypatch):
    monkeypatch.setattr(products, "get_product_sources", lambda: (FailingSource(), products.CatalogSource()))
    data = client.post("/recommend-products", json=VALID).json()
    assert data["sources"] == ["local_catalog"] and data["total_inr"] == 46000
    assert "unavailable" in data["notices"][0] and "connection reset" not in json.dumps(data)


def test_empty_live_results_still_use_catalog(client, monkeypatch):
    monkeypatch.setattr(products, "get_product_sources", lambda: (FixedSource([]), products.CatalogSource()))
    data = client.post("/recommend-products", json=VALID).json()
    assert data["sources"] == ["local_catalog"] and data["notices"] == []


def test_duplicate_urls_across_sources_are_merged():
    live = Product(**{**verified("lamp", "lighting", 3800), "id": "live-lamp", "source": "fixed"})
    result = build_plan(req(), [live, Product(**verified("lamp", "lighting", 4000))], ["fixed"], [])
    assert [i.id for i in result.items] == ["live-lamp"]


def test_unknown_product_provider_rejected(monkeypatch):
    monkeypatch.setenv("SPACESENSE_PRODUCT_PROVIDER", "scraper")
    with pytest.raises(providers.ProviderConfigError):
        products.get_product_sources()


def test_serpapi_requires_key(monkeypatch):
    monkeypatch.setenv("SPACESENSE_PRODUCT_PROVIDER", "serpapi")
    with pytest.raises(providers.ProviderConfigError, match="SERPAPI_API_KEY"):
        products.get_product_sources()


def test_serpapi_configured_order(monkeypatch):
    monkeypatch.setenv("SPACESENSE_PRODUCT_PROVIDER", "serpapi")
    monkeypatch.setenv("SERPAPI_API_KEY", "test-key")
    assert [s.name for s in products.get_product_sources()] == ["serpapi_google_shopping", "local_catalog"]


SERP_RESULTS = {"shopping_results": [
    {"title": "Linen sofa", "link": "https://www.flipkart.com/linen-sofa/p/itm1", "price": "₹24,999",
     "extracted_price": 24999, "thumbnail": "https://encrypted-tbn0.gstatic.com/a.jpg"},
    {"title": "Google-only listing", "product_link": "https://www.google.com/shopping/product/1",
     "price": "₹9,999", "extracted_price": 9999},                       # not a retailer page: dropped
    {"title": "Unknown shop sofa", "link": "https://cheap-sofas.example/x", "price": "₹5,000",
     "extracted_price": 5000},                                           # unsupported retailer: dropped
    {"title": "No price", "link": "https://www.amazon.in/dp/B000"},      # no price: dropped
    {"title": "Dollar sofa", "link": "https://www.amazon.in/dp/B001", "price": "$300",
     "extracted_price": 300},                                            # not INR: dropped
]}


def test_serpapi_keeps_only_priced_retailer_results():
    calls = []
    source = SerpApiShopping("k", fetch=lambda url, t: calls.append(url) or SERP_RESULTS, today=lambda: date(2026, 10, 10))
    found = source.find(req(), ["seating"])
    assert len(found) == 1
    p = found[0]
    assert (p.retailer, p.price_inr, p.price_status, p.last_checked) == ("Flipkart", 24999, "verified", date(2026, 10, 10))
    assert "gl=in" in calls[0] and "scandinavian+sofa" in calls[0]


def test_serpapi_caches_and_limits_queries():
    calls = []
    source = SerpApiShopping("k", fetch=lambda url, t: calls.append(url) or {"shopping_results": []})
    cats = ["seating", "tables", "lighting", "rugs", "curtains"]
    source.find(req(), cats)
    source.find(req(), cats)
    assert len(calls) == 3


def test_serpapi_errors_raise_source_error():
    source = SerpApiShopping("k", fetch=lambda url, t: {"error": "Invalid API key."})
    with pytest.raises(ProductSourceError):
        source.find(req(), ["seating"])
    empty = SerpApiShopping("k", fetch=lambda url, t: {"error": "Google hasn't returned any results for this query."})
    assert empty.find(req(), ["seating"]) == []


def test_health_lists_product_sources(client):
    assert client.get("/health").json()["providers"]["products"] == ["local_catalog"]


def test_startup_fails_on_bad_product_provider(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("SPACESENSE_PRODUCT_PROVIDER", "scraper")
    with pytest.raises(providers.ProviderConfigError):
        with TestClient(main.app):
            pass
