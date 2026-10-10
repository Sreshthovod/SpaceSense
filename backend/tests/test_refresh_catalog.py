import json

from tools import refresh_catalog as rc

PAGE = """<html><script type="application/ld+json">{"@type": "BreadcrumbList"}</script>
<script type="application/ld+json">{"@type": "Product", "name": "LACK Coffee table - white 90x55 cm (35 3/8x21 5/8 \\")",
 "image": [{"contentUrl": "https://www.ikea.com/in/en/images/products/lack.jpg"}],
 "offers": {"price": "3490", "priceCurrency": "INR", "availability": "https://schema.org/InStock"}}</script></html>"""

ITEM = {"id": "lack", "name": "old", "category": "tables", "styles": ["scandinavian"], "room_types": ["living room"],
        "why": "w", "search_query": "coffee table", "retailer": "IKEA India",
        "product_url": "https://www.ikea.com/in/en/p/lack-coffee-table-90431533/", "price_status": "unknown"}


def test_extracts_listing_details_from_schema_org():
    data = rc.extract(rc.product_ld(PAGE))
    assert data == {"name": "LACK Coffee table - white", "price_inr": 3490, "availability": "in_stock",
                    "image_url": "https://www.ikea.com/in/en/images/products/lack.jpg", "dimensions": "90x55 cm"}


def test_refresh_marks_verified_with_date(monkeypatch):
    monkeypatch.setattr(rc, "fetch", lambda url: PAGE)
    items = [dict(ITEM)]
    rc.refresh(items, "2026-10-10", pause=0)
    assert items[0]["price_status"] == "verified" and items[0]["last_checked"] == "2026-10-10"
    assert items[0]["price_inr"] == 3490


def test_refresh_downgrades_when_price_missing_or_page_fails(monkeypatch):
    stale = {**ITEM, "price_inr": 3490, "price_status": "verified", "last_checked": "2026-01-01",
             "image_url": "https://www.ikea.com/x.jpg", "availability": "in_stock"}
    for fetch in (lambda url: PAGE.replace('"priceCurrency": "INR"', '"priceCurrency": "EUR"'),
                  lambda url: (_ for _ in ()).throw(OSError("timeout"))):
        monkeypatch.setattr(rc, "fetch", fetch)
        items = [dict(stale)]
        rc.refresh(items, "2026-10-10", pause=0)
        assert items[0]["price_status"] == "unknown"
        assert not {"price_inr", "image_url", "availability", "last_checked"} & items[0].keys()


def test_refresh_skips_unsupported_domains(monkeypatch):
    monkeypatch.setattr(rc, "fetch", lambda url: (_ for _ in ()).throw(AssertionError("must not fetch")))
    items = [{**ITEM, "product_url": "https://example.com/p/1"}]
    assert "SKIP" in rc.refresh(items, "2026-10-10", pause=0)[0]


def test_refreshed_items_pass_catalog_validation(monkeypatch, tmp_path):
    from services import products

    monkeypatch.setattr(rc, "fetch", lambda url: PAGE)
    items = [dict(ITEM)]
    rc.refresh(items, "2026-10-10", pause=0)
    path = tmp_path / "c.json"
    path.write_text(json.dumps(items))
    products.load_catalog.cache_clear()
    assert products.load_catalog(path)[0].price_inr == 3490
    products.load_catalog.cache_clear()
