import base64
import json

import pytest
from fastapi.testclient import TestClient

import main
from services import products, providers

SAMPLE = [
    {"id": "sofa", "name": "Sofa", "category": "seating", "price_inr": 30000, "dimensions": "200 cm",
     "styles": ["scandinavian"], "room_types": ["living room"]},
    {"id": "table", "name": "Table", "category": "tables", "price_inr": 12000, "dimensions": "100 cm",
     "styles": ["scandinavian"], "room_types": ["living room"]},
    {"id": "lamp", "name": "Lamp", "category": "lighting", "price_inr": 4000, "dimensions": "150 cm",
     "styles": ["scandinavian"], "room_types": ["living room"]},
    {"id": "desk", "name": "Desk", "category": "tables", "price_inr": 9000, "dimensions": "120 cm",
     "styles": ["minimalist"], "room_types": ["home office"]},
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
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    caches = (providers.get_room_analyzer, providers.get_room_chat, providers.get_design_editor)
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
