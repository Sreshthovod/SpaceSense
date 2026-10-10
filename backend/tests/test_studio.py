"""3D Room Designer pricing: every number comes from the verified catalog, never from the client."""
import json
import re

import pytest
from fastapi.testclient import TestClient

import main
from services import products, studio
from tests.conftest import SAMPLE

REAL_PRODUCTS = {p["id"]: p for p in json.loads(products.CATALOG_PATH.read_text(encoding="utf-8"))}
REAL_MAPPING = json.loads(studio.STUDIO_CATALOG_PATH.read_text(encoding="utf-8"))

# What each designer type may be: the product's catalog category and a word its name must contain.
TYPE_RULES = {
    "sofa": ("seating", r"sofa"),
    "armchair": ("seating", r"armchair|chair"),
    "coffee-table": ("tables", r"coffee table"),
    "side-table": ("tables", r"side table"),
    "dining-table": ("tables", r"table"),
    "bed": ("beds", r"bed"),
    "wardrobe": ("storage", r"wardrobe"),
    "bookshelf": ("storage", r"bookcase|shelving"),
    "rug": ("rugs", r"rug"),
    "small-plant": ("decor", r"plant"),
    "dining-chair": ("seating", r"chair"),
    "desk-chair": ("seating", r"office chair"),
    "study-desk": ("tables", r"desk"),
    "bedside-table": ("tables", r"bedside table"),
    "bunk-bed": ("beds", r"bunk bed"),
    "dresser": ("storage", r"chest of .*drawers"),
    "tv-unit": ("storage", r"tv bench"),
    "table-lamp": ("lighting", r"table lamp"),
    "floor-lamp": ("lighting", r"floor lamp"),
    "painting": ("decor", r"frame"),
    "mirror": ("decor", r"mirror"),
    "curtains": ("curtains", r"curtain"),
}


def clear_caches():
    products.load_catalog.cache_clear()
    studio.load_mapping.cache_clear()


@pytest.fixture
def real():
    """The shipped catalog and mapping, as the app uses them."""
    clear_caches()
    yield TestClient(main.app, raise_server_exceptions=False)
    clear_caches()


@pytest.fixture
def sample(tmp_path, monkeypatch):
    """A small catalog plus a mapping that also points at an unpriced idea and a missing id."""
    cat = tmp_path / "products.json"
    cat.write_text(json.dumps(SAMPLE))
    mapping = {
        "budget_categories": {"furniture": "Furniture", "lighting": "Lighting", "accessories": "Accessories",
                              "wall_finishes": "Wall finishes", "flooring": "Flooring"},
        "types": {
            "sofa": {"category": "furniture", "products": ["sofa", "dhurrie", "gone"]},
            "floor-lamp": {"category": "lighting", "products": ["lamp"]},
            "coffee-table": {"category": "furniture", "products": ["table"]},
            "pouf": {"category": "accessories", "products": []},
        },
    }
    path = tmp_path / "studio.json"
    path.write_text(json.dumps(mapping))
    monkeypatch.setattr(products, "CATALOG_PATH", cat)
    monkeypatch.setattr(studio, "STUDIO_CATALOG_PATH", path)
    clear_caches()
    yield TestClient(main.app, raise_server_exceptions=False), path
    clear_caches()


def price(client, **body):
    return client.post("/studio/price", json={"budget_inr": 50000, **body})


# --- the shipped mapping is truthful -----------------------------------------------------------

@pytest.mark.parametrize("type_name", sorted(REAL_MAPPING["types"]))
def test_every_mapped_product_is_verified_and_the_right_kind(type_name):
    for pid in REAL_MAPPING["types"][type_name]["products"]:
        p = REAL_PRODUCTS[pid]
        assert p["price_status"] == "verified" and p["price_inr"] > 0 and p["product_url"].startswith("https://")
        category, word = TYPE_RULES[type_name]
        assert p["category"] == category, pid
        assert re.search(word, p["name"], re.I), f"{pid} is not a {type_name}"


def test_types_match_the_frontend_catalog():
    src = (studio.STUDIO_CATALOG_PATH.parents[2] / "frontend/src/designer/model/catalog.js").read_text(encoding="utf-8")
    frontend = set(re.findall(r"^\s+'?([a-z-]+)'?: \{\s*(?:\n\s+)?name:", src, re.M)) - {"door", "window"}
    assert frontend == set(REAL_MAPPING["types"])


def test_catalog_endpoint_lists_verified_prices(real):
    data = real.get("/studio/catalog").json()
    assert data["currency"] == "INR"
    assert set(data["types"]) == set(REAL_MAPPING["types"])
    kivik = next(p for p in data["types"]["sofa"]["products"] if p["product_id"] == "ikea-kivik-sofa")
    assert kivik["price_inr"] == REAL_PRODUCTS["ikea-kivik-sofa"]["price_inr"]
    assert kivik["last_checked"] == REAL_PRODUCTS["ikea-kivik-sofa"]["last_checked"]
    assert data["types"]["pouf"]["products"] == []


# --- totals --------------------------------------------------------------------------------------

def test_totals_are_the_sum_of_catalog_prices(real):
    items = [
        {"uid": "a", "type": "sofa", "product_id": "ikea-kivik-sofa"},
        {"uid": "b", "type": "coffee-table", "product_id": "ikea-lack-coffee-table"},
        {"uid": "c", "type": "floor-lamp", "product_id": "ikea-hektar-floor-lamp"},
        {"uid": "d", "type": "rug", "product_id": "ikea-lohals-rug"},
    ]
    data = price(real, budget_inr=80000, items=items).json()
    expected = sum(REAL_PRODUCTS[i["product_id"]]["price_inr"] for i in items)
    assert data["total_inr"] == expected
    assert data["remaining_inr"] == 80000 - expected
    assert data["over_budget_inr"] is None
    assert data["used_ratio"] == pytest.approx(expected / 80000, abs=1e-4)
    cats = {c["id"]: c for c in data["categories"]}
    assert cats["furniture"]["total_inr"] == REAL_PRODUCTS["ikea-kivik-sofa"]["price_inr"] + REAL_PRODUCTS["ikea-lack-coffee-table"]["price_inr"]
    assert cats["lighting"]["total_inr"] == REAL_PRODUCTS["ikea-hektar-floor-lamp"]["price_inr"]
    assert cats["accessories"]["total_inr"] == REAL_PRODUCTS["ikea-lohals-rug"]["price_inr"]
    assert sum(c["total_inr"] for c in data["categories"]) == data["total_inr"]


def test_unpriced_lines_never_count(real):
    items = [
        {"uid": "a", "type": "sofa", "product_id": "ikea-glostad-sofa"},
        {"uid": "b", "type": "sofa"},  # generic shape, no product picked
        {"uid": "c", "type": "pouf"},  # no verified product exists for this type
    ]
    surfaces = [{"id": "walls", "label": "Wall paint: Warm white"}, {"id": "floor", "label": "Flooring: Wood"}]
    data = price(real, items=items, surfaces=surfaces).json()
    assert data["total_inr"] == REAL_PRODUCTS["ikea-glostad-sofa"]["price_inr"]
    assert data["unpriced_count"] == 4
    reasons = {line["uid"] or line["type"]: line["reason"] for line in data["lines"]}
    assert reasons == {"a": None, "b": "generic", "c": "no_products", "walls": "finish", "floor": "finish"}
    cats = {c["id"]: c for c in data["categories"]}
    assert cats["wall_finishes"] == {"id": "wall_finishes", "label": "Wall finishes", "total_inr": 0, "priced_count": 0, "unpriced_count": 1}
    assert cats["flooring"]["unpriced_count"] == 1


def test_over_budget_and_zero_budget(real):
    items = [{"uid": "a", "type": "sofa", "product_id": "ikea-friheten-sofa-bed"}]
    over = price(real, budget_inr=10000, items=items).json()
    cost = REAL_PRODUCTS["ikea-friheten-sofa-bed"]["price_inr"]
    assert over["over_budget_inr"] == cost - 10000
    assert over["remaining_inr"] == 10000 - cost
    assert over["suggestions"] == []
    assert price(real, budget_inr=0).json()["used_ratio"] is None


def test_budget_or_style_changes_never_change_the_lines(real):
    items = [{"uid": "a", "type": "sofa", "product_id": "ikea-kivik-sofa"}, {"uid": "b", "type": "plant"}]
    a = price(real, budget_inr=30000, style="scandinavian", items=items).json()
    b = price(real, budget_inr=900000, style="industrial", items=items).json()
    assert a["lines"] == b["lines"]


# --- the client can't set prices or invent products -----------------------------------------------

def test_client_sent_price_is_rejected(real):
    r = price(real, items=[{"uid": "a", "type": "sofa", "product_id": "ikea-kivik-sofa", "price_inr": 1}])
    assert r.status_code == 422 and r.json()["error"] == "validation_error"
    assert price(real, total_inr=1).status_code == 422


@pytest.mark.parametrize("item, field", [
    ({"uid": "a", "type": "spaceship"}, "items.0.type"),
    ({"uid": "a", "type": "sofa", "product_id": "ikea-hektar-floor-lamp"}, "items.0.product_id"),
    ({"uid": "a", "type": "sofa", "product_id": "made-up"}, "items.0.product_id"),
])
def test_unknown_types_and_wrong_products_are_rejected(real, item, field):
    r = price(real, items=[item])
    assert r.status_code == 422
    assert r.json() == {"error": "invalid_design", "details": [{"field": field, "message": r.json()["details"][0]["message"]}]}


@pytest.mark.parametrize("body", [
    {"items": [{"uid": "a", "type": "sofa"}, {"uid": "a", "type": "sofa"}]},
    {"items": [{"uid": "bad uid!", "type": "sofa"}]},
    {"style": "gothic"},
    {"budget_inr": -1},
    {"surfaces": [{"id": "ceiling", "label": "x"}]},
])
def test_malformed_requests_are_rejected(real, body):
    assert price(real, **body).status_code == 422


# --- suggestions -----------------------------------------------------------------------------------

def test_suggestions_fit_the_budget_and_prefer_the_style(real):
    data = price(real, budget_inr=20000, style="scandinavian",
                 items=[{"uid": "a", "type": "rug", "product_id": "ikea-lohals-rug"}]).json()
    remaining = data["remaining_inr"]
    assert 0 < len(data["suggestions"]) <= 4
    types = [s["type"] for s in data["suggestions"]]
    assert len(types) == len(set(types))
    for s in data["suggestions"]:
        assert s["product"]["price_inr"] <= remaining
        assert s["product"]["product_id"] != "ikea-lohals-rug"
    flags = ["scandinavian" in s["product"]["styles"] for s in data["suggestions"]]
    assert flags == sorted(flags, reverse=True)  # style matches come first


# --- catalog edge cases ------------------------------------------------------------------------------

def test_unverified_or_missing_mapped_products_are_never_priced(sample):
    client, _ = sample
    sofa_products = client.get("/studio/catalog").json()["types"]["sofa"]["products"]
    assert [p["product_id"] for p in sofa_products] == ["sofa"]  # the unpriced idea and missing id are left out
    data = price(client, items=[{"uid": "a", "type": "sofa", "product_id": "dhurrie"}]).json()
    assert data["lines"][0]["price_status"] == "unavailable"
    assert data["lines"][0]["reason"] == "unverified"
    assert data["total_inr"] == 0


def test_broken_mapping_returns_503(sample):
    client, path = sample
    path.write_text('{"budget_categories": {}, "types": {"sofa": {"category": "nope", "products": []}}}')
    studio.load_mapping.cache_clear()
    r = client.get("/studio/catalog")
    assert r.status_code == 503 and r.json()["error"] == "catalog_unavailable"
