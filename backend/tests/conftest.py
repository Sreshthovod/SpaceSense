import base64
import json

import pytest
from fastapi.testclient import TestClient

import main
from services import imagegen, products, providers



def verified(id, category, price, styles=("scandinavian",), rooms=("living room",), **kw):
    """A catalog entry with a verified retailer page and price."""
    return {"id": id, "name": id.title(), "category": category, "price_inr": price, "price_status": "verified",
            "retailer": "IKEA India", "product_url": f"https://www.ikea.com/in/en/p/{id}-0001/",
            "image_url": f"https://www.ikea.com/in/en/images/products/{id}.jpg", "availability": "in_stock",
            "last_checked": "2026-10-10", "styles": list(styles), "room_types": list(rooms),
            "why": f"Why {id} suits the room.", "search_query": id, **kw}


def idea(id, category, styles=("scandinavian",), rooms=("living room",), **kw):
    """An unpriced suggestion: no product page, so it gets retailer search links."""
    return {"id": id, "name": id.title(), "category": category, "styles": list(styles), "room_types": list(rooms),
            "why": f"Why {id} suits the room.", "search_query": f"{id} search", **kw}


SAMPLE = [
    verified("sofa", "seating", 30000, colors=["light grey"]),
    verified("table", "tables", 12000),
    verified("lamp", "lighting", 4000),
    verified("desk", "tables", 9000, styles=("minimalist",), rooms=("home office",)),
    idea("dhurrie", "rugs"),
]

VALID = {
    "room_type": "Living room", "length_ft": 14, "width_ft": 12, "height_ft": 9,
    "style": "scandinavian", "budget_inr": 60000, "vastu": True,
}

# A real 1x1 PNG, used as the "original upload".
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
APPROVED = {"items": ["Paint the walls warm white", "Replace the sofa with a light linen sofa"], "notes": "Keep the rug"}


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch):
    """Tests never use real credentials or whatever providers backend/.env selects."""
    monkeypatch.setenv("SPACESENSE_ANALYSIS_PROVIDER", "rule_based")
    monkeypatch.setenv("SPACESENSE_DESIGN_PROVIDER", "mock")
    monkeypatch.setenv("SPACESENSE_PRODUCT_PROVIDER", "catalog")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("SERPAPI_API_KEY", raising=False)
    monkeypatch.delenv("CF_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("CF_API_TOKEN", raising=False)
    imagegen.reset_rate_limiter()
    caches = (providers.get_room_analyzer, providers.get_room_chat, providers.get_design_editor,
              products.get_product_sources)
    for c in caches:
        c.cache_clear()
    yield
    for c in caches:
        c.cache_clear()


@pytest.fixture
def catalog_file(tmp_path, monkeypatch):
    """Point the service at a temporary catalog so the real one is never touched."""
    path = tmp_path / "products.json"
    path.write_text(json.dumps(SAMPLE))
    monkeypatch.setattr(products, "CATALOG_PATH", path)
    products.load_catalog.cache_clear()
    yield path
    products.load_catalog.cache_clear()


@pytest.fixture
def client(catalog_file):
    # raise_server_exceptions=False so unhandled errors are returned as real 500 responses.
    return TestClient(main.app, raise_server_exceptions=False)


def analyze(client, room=None, photo=PNG, filename="room.png"):
    return client.post(
        "/analyze-room",
        data={"room": json.dumps(VALID if room is None else room)},
        files={"photo": (filename, photo, "image/png")},
    )


def edit(client, room=None, photo=PNG, instructions=None, approved="true"):
    data = {"room": json.dumps(VALID if room is None else room),
            "instructions": json.dumps(APPROVED if instructions is None else instructions)}
    if approved is not None:
        data["approved"] = approved
    return client.post("/generate-design", data=data, files={"photo": ("room.png", photo, "image/png")})


def chat(client, messages=None, recommendations=None, room=None, photo=PNG):
    body = {"messages": messages or [{"role": "user", "content": "What colour should the sofa be?"}]}
    if recommendations is not None:
        body["recommendations"] = recommendations
    return client.post(
        "/chat",
        data={"room": json.dumps(VALID if room is None else room), "chat": json.dumps(body)},
        files={"photo": ("room.png", photo, "image/png")},
    )
