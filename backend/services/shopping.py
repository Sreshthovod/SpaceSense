"""Optional live product source: Google Shopping results for India via SerpAPI.

Enabled with SPACESENSE_PRODUCT_PROVIDER=serpapi and SERPAPI_API_KEY (https://serpapi.com,
which has a small free monthly quota). It's an authorised API, so no retailer site is scraped.

A result is kept only if it links straight to a supported retailer domain and carries a price
in rupees; everything else is dropped rather than guessed. The listed price is what the
search returned at `last_checked`; the UI tells users to confirm it on the retailer's page.
"""
import hashlib
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import date
from urllib.parse import urlencode

from schemas import Product, ProductRequest, retailer_for_url
from services.products import ProductSourceError

ENDPOINT = "https://serpapi.com/search.json"
MAX_QUERIES = 3  # categories searched per request, to protect the API quota
RESULTS_PER_QUERY = 4
CACHE_TTL_S = 3600

CATEGORY_QUERIES = {
    "seating": "sofa", "tables": "table", "beds": "bed", "storage": "storage cabinet",
    "lighting": "floor lamp", "rugs": "rug", "curtains": "curtains", "decor": "wall decor",
}
ROOM_QUERIES = {"kitchen": {"seating": "bar stool", "tables": "dining table"},
                "dining room": {"seating": "dining chair", "tables": "dining table"},
                "home office": {"seating": "office chair", "tables": "study desk"},
                "kids room": {"beds": "kids bed", "tables": "kids study table"},
                "bedroom": {"tables": "bedside table", "storage": "wardrobe"}}


def _http_get_json(url: str, timeout: float) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise ProductSourceError(f"SerpAPI request failed: {exc}") from exc


class SerpApiShopping:
    name = "serpapi_google_shopping"

    def __init__(self, api_key: str, fetch: Callable[[str, float], dict] = _http_get_json, timeout: float = 15.0,
                 today: Callable[[], date] = date.today):
        self._key = api_key
        self._fetch = fetch
        self._timeout = timeout
        self._today = today
        self._cache: dict[str, tuple[float, list[dict]]] = {}

    def query_for(self, req: ProductRequest, category: str) -> str:
        noun = ROOM_QUERIES.get(req.room_type, {}).get(category, CATEGORY_QUERIES[category])
        return f"{req.style.replace('-', ' ')} {noun}"

    def _results(self, query: str) -> list[dict]:
        hit = self._cache.get(query)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
        params = {"engine": "google_shopping", "q": query, "gl": "in", "hl": "en", "location": "India",
                  "api_key": self._key}
        data = self._fetch(f"{ENDPOINT}?{urlencode(params)}", self._timeout)
        if "error" in data and "shopping_results" not in data:
            if "hasn't returned any results" in str(data["error"]):
                results: list[dict] = []
            else:
                raise ProductSourceError(f"SerpAPI error: {data['error']}")
        else:
            results = data.get("shopping_results") or []
        self._cache[query] = (time.monotonic(), results)
        return results

    def to_product(self, raw: dict, req: ProductRequest, category: str, query: str) -> Product | None:
        url = raw.get("link") or raw.get("product_link") or ""
        retailer = retailer_for_url(url) if url else None
        price = raw.get("extracted_price")
        title = str(raw.get("title") or "").strip()
        if retailer is None or not title or not isinstance(price, (int, float)) or price <= 0:
            return None
        if not str(raw.get("price", "")).lstrip().startswith("₹"):
            return None  # only rupee prices count; no currency conversion
        image = raw.get("thumbnail")
        return Product(
            id="serp-" + hashlib.sha1(url.encode()).hexdigest()[:12],
            name=title[:200],
            category=category,
            styles=[req.style],
            room_types=[req.room_type],
            why=f"Found by a live shopping search for “{query}”. Check the listing to confirm size and finish suit your room.",
            retailer=retailer,
            product_url=url,
            image_url=image if isinstance(image, str) and image.startswith("https://") else None,
            price_inr=round(price),
            price_status="verified",
            last_checked=self._today(),
            source=self.name,
            search_query=query,
        )

    def find(self, req: ProductRequest, categories: list[str]) -> list[Product]:
        products = []
        for category in categories[:MAX_QUERIES]:
            query = self.query_for(req, category)
            for raw in self._results(query)[:RESULTS_PER_QUERY * 3]:
                product = self.to_product(raw, req, category, query)
                if product is not None:
                    products.append(product)
                if sum(p.category == category for p in products) >= RESULTS_PER_QUERY:
                    break
        return products
