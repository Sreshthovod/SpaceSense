import json

import pytest
from fastapi.testclient import TestClient

import main
from services import products

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
