import json

import pytest

import main
from config import get_allowed_origin_regex, get_allowed_origins
from services import products, providers
from tests.conftest import PNG, VALID, analyze, edit


def body(**overrides):
    return {**VALID, **overrides}


# --- health ---
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["providers"] == {"analysis": "rule_based", "chat": "offline", "design": "mock",
                                     "products": ["local_catalog"]}


# --- analyze-room input validation ---
def test_analyze_valid_rule_based(client):
    r = analyze(client)
    assert r.status_code == 200
    data = r.json()
    assert data["method"] == "rule_based" and data["photo_analyzed"] is False
    assert data["area_sqft"] == 168.0 and data["volume_cuft"] == 1512.0
    assert data["size_category"] == "medium" and data["budget_tier"] == "mid-range"
    assert len(data["vastu_notes"]) == 3
    recs = data["recommendations"]
    assert recs["summary"] and recs["colors"] and recs["lighting"] and recs["budget_tips"]
    assert "not analysed" in data["disclaimer"]


def test_analyze_without_vastu_has_no_vastu_notes(client):
    assert analyze(client, body(vastu=False)).json()["vastu_notes"] == []


@pytest.mark.parametrize("endpoint", ["/analyze-room", "/generate-design"])
def test_missing_multipart_fields_rejected(client, endpoint):
    r = client.post(endpoint, data={"approved": "true"})
    assert r.status_code == 422
    fields = {d["field"] for d in r.json()["details"]}
    assert {"room", "photo"} <= fields


def test_missing_room_fields_rejected(client):
    r = analyze(client, {})
    assert r.status_code == 422
    assert {d["field"] for d in r.json()["details"]} >= {"room.room_type", "room.style", "room.budget_inr"}


def test_invalid_room_type_and_style(client):
    r = analyze(client, body(room_type="sauna", style="baroque"))
    assert r.status_code == 422
    assert {d["field"] for d in r.json()["details"]} == {"room.room_type", "room.style"}


@pytest.mark.parametrize("field", ["length_ft", "width_ft", "height_ft"])
@pytest.mark.parametrize("value", [0, -5, 1000])
def test_bad_dimensions_rejected(client, field, value):
    r = analyze(client, body(**{field: value}))
    assert r.status_code == 422
    assert r.json()["details"][0]["field"] == f"room.{field}"


def test_negative_budget_rejected(client):
    r = analyze(client, body(budget_inr=-1))
    assert r.status_code == 422 and r.json()["details"][0]["field"] == "room.budget_inr"


def test_unknown_room_field_rejected(client):
    assert analyze(client, body(api_key="x")).status_code == 422


def test_room_field_must_be_json(client):
    r = client.post("/analyze-room", data={"room": "{bad"}, files={"photo": ("r.png", PNG, "image/png")})
    assert r.status_code == 422 and r.json()["details"][0]["field"] == "room"


def test_unknown_route_uses_error_format(client):
    r = client.get("/nope")
    assert r.status_code == 404 and r.json()["error"] == "http_error"


# --- recommend-products (JSON) ---
def test_recommend_missing_fields_rejected(client):
    r = client.post("/recommend-products", json={})
    assert r.status_code == 422 and r.json()["error"] == "validation_error"


def test_recommend_malformed_json(client):
    r = client.post("/recommend-products", content="{bad", headers={"Content-Type": "application/json"})
    assert r.status_code == 422


def test_recommendations_valid_and_total_correct(client):
    data = client.post("/recommend-products", json=VALID).json()
    assert data["sources"] == ["local_catalog"]
    chosen = [i for i in data["items"] if i["selected"]]
    assert {i["id"] for i in chosen} == {"sofa", "table", "lamp"}  # desk is another room/style
    assert data["total_inr"] == sum(i["line_total_inr"] for i in chosen) == 46000
    assert data["remaining_inr"] == 14000


@pytest.mark.parametrize("budget", [0, 1, 3999, 4000, 15999, 16000, 33999, 46000, 1_000_000])
def test_total_never_exceeds_budget(client, budget):
    data = client.post("/recommend-products", json=body(budget_inr=budget)).json()
    chosen = [i for i in data["items"] if i["selected"]]
    assert data["total_inr"] <= budget
    assert data["total_inr"] == sum(i["line_total_inr"] for i in chosen)
    assert data["remaining_inr"] == budget - data["total_inr"]


def test_budget_too_small_for_everything(client):
    data = client.post("/recommend-products", json=body(budget_inr=100)).json()
    assert not any(i["selected"] for i in data["items"]) and data["total_inr"] == 0
    assert "below the cheapest" in data["note"] and data["shortfall_inr"] == 4000 - 100


def test_no_matching_products(client):
    data = client.post("/recommend-products", json=body(room_type="kitchen")).json()
    assert data["items"] == [] and "No products" in data["note"]


def test_negative_budget_rejected_for_products(client):
    assert client.post("/recommend-products", json=body(budget_inr=-5)).status_code == 422


# --- catalog / internal errors ---
def _item(**kw):
    return {"id": "x", "name": "A", "category": "rugs", "styles": ["boho"], "room_types": ["bedroom"],
            "why": "w", "search_query": "rug", **kw}


def test_malformed_catalog_returns_safe_503(client, catalog_file):
    catalog_file.write_text(json.dumps([_item(price_inr=-5)]))
    products.load_catalog.cache_clear()
    r = client.post("/recommend-products", json=VALID)
    assert r.status_code == 503 and r.json() == {"error": "catalog_unavailable", "details": []}
    assert "price_inr" not in r.text and "Traceback" not in r.text


def test_missing_catalog_invalid_json_and_duplicates(client, catalog_file):
    for content in ("not json", json.dumps([_item(id="dup"), _item(id="dup")])):
        catalog_file.write_text(content)
        products.load_catalog.cache_clear()
        assert client.post("/recommend-products", json=VALID).status_code == 503
    catalog_file.unlink()
    products.load_catalog.cache_clear()
    assert client.post("/recommend-products", json=VALID).status_code == 503


def test_unexpected_error_is_hidden(client, monkeypatch):
    class Boom:
        name = "boom"

        def analyze(self, *_):
            raise RuntimeError("secret internal detail")

    monkeypatch.setattr(main, "get_room_analyzer", lambda: Boom())
    r = analyze(client)
    assert r.status_code == 500 and r.json() == {"error": "internal_error", "details": []}
    assert "secret" not in r.text


def test_real_catalog_is_valid():
    products.load_catalog.cache_clear()
    items = products.load_catalog(products.CATALOG_PATH.parent / "products.json")
    assert items and all(p.price_inr > 0 for p in items if p.price_status == "verified")
    products.load_catalog.cache_clear()


# --- provider configuration ---
def test_unknown_provider_name_is_rejected(monkeypatch):
    monkeypatch.setenv("SPACESENSE_DESIGN_PROVIDER", "imaginary")
    with pytest.raises(providers.ProviderConfigError):
        providers.get_design_editor()


def test_gemini_provider_requires_api_key(monkeypatch):
    monkeypatch.setenv("SPACESENSE_ANALYSIS_PROVIDER", "gemini")
    with pytest.raises(providers.ProviderConfigError, match="GEMINI_API_KEY"):
        providers.get_room_analyzer()


def test_app_refuses_to_start_with_bad_provider_config(monkeypatch, catalog_file):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("SPACESENSE_DESIGN_PROVIDER", "gemini")  # no key set
    with pytest.raises(providers.ProviderConfigError):
        with TestClient(main.app):
            pass


# --- CORS ---
def preflight(client, origin):
    return client.options("/analyze-room", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5175", "http://localhost:4173"])
def test_cors_allows_vite_origins(client, origin):
    r = preflight(client, origin)
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", ["http://evil.example", "http://localhost.evil.example", "http://192.168.1.5:5173"])
def test_cors_rejects_other_origins(client, origin):
    r = preflight(client, origin)
    assert r.status_code == 400 and "access-control-allow-origin" not in r.headers


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("SPACESENSE_CORS_ORIGINS", "https://a.example/, *, https://b.example")
    assert get_allowed_origins() == ["https://a.example", "https://b.example"]
    assert get_allowed_origin_regex() is None  # an explicit list replaces the localhost default


def test_cors_defaults_to_local_origins(monkeypatch):
    monkeypatch.delenv("SPACESENSE_CORS_ORIGINS", raising=False)
    assert get_allowed_origins() == [] and get_allowed_origin_regex() is not None


def test_edit_helper_smoke(client):
    assert edit(client).status_code == 200
