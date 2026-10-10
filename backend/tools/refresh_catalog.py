"""Re-check the verified products in backend/data/products.json against their retailer pages.

    cd backend && python -m tools.refresh_catalog            # update the catalog in place
    cd backend && python -m tools.refresh_catalog --dry-run  # only report what would change

Only the schema.org Product data a retailer publishes on its public product page is read
(name, listed price, currency, availability, first image, dimensions), one page at a time
with a pause between requests. Nothing is guessed: if a page can't be read, or no INR price
is published, the product is downgraded to an unverified suggestion (no price, no image,
no availability) rather than keeping stale numbers.

Generic suggestions (no product_url) are left untouched.
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.products import CATALOG_PATH, retailer_for_url  # noqa: E402

USER_AGENT = "Mozilla/5.0 (compatible; SpaceSense catalog check; manual, low-rate)"
PAUSE_S = 2.0
LD_JSON = re.compile(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.S)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-IN"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def product_ld(page: str) -> dict | None:
    """The first schema.org Product object on the page, if any."""
    for block in LD_JSON.findall(page):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("@type") == "Product":
                return item
    return None


SIZE_SUFFIX = re.compile(r"\s(\d[\d.,x×-]*\s?cm)(?:\s*\([^)]*\))?\s*$")


def split_size(name: str) -> tuple[str, str | None]:
    """IKEA-style names end with the size, e.g. 'LACK Coffee table - white 90x55 cm (35x21 ")'."""
    match = SIZE_SUFFIX.search(name)
    if not match:
        return name, None
    return name[: match.start()].strip(), match.group(1)


def extract(ld: dict) -> dict:
    """Map schema.org Product data to catalog fields. Missing data stays missing."""
    offer = ld.get("offers") or {}
    if isinstance(offer, list):
        offer = offer[0] if offer else {}
    out: dict = {"name": html.unescape(str(ld.get("name", ""))).strip()}

    price = offer.get("price")
    if offer.get("priceCurrency") == "INR" and price not in (None, ""):
        out["price_inr"] = round(float(price))

    availability = str(offer.get("availability", ""))
    if availability:
        out["availability"] = "in_stock" if availability.endswith("InStock") else "out_of_stock" \
            if availability.endswith("OutOfStock") else None

    images = ld.get("image") or []
    first = images[0] if isinstance(images, list) and images else images
    if isinstance(first, dict):
        first = first.get("contentUrl")
    if isinstance(first, str) and first.startswith("https://"):
        out["image_url"] = first

    # Width/depth/height fields are inconsistent between product types, so only the size the
    # retailer prints in the product name is used.
    out["name"], size = split_size(out["name"])
    if size:
        out["dimensions"] = size
    return out


def refresh(items: list[dict], today: str, pause: float = PAUSE_S) -> list[str]:
    report = []
    for item in items:
        url = item.get("product_url")
        if not url:
            continue
        if retailer_for_url(url) is None:
            report.append(f"SKIP {item['id']}: {url} is not on a supported retailer domain")
            continue
        try:
            ld = product_ld(fetch(url))
            data = extract(ld) if ld else {}
        except Exception as exc:  # network errors, HTTP errors, bad numbers
            data, ld = {}, None
            report.append(f"FAIL {item['id']}: {exc}")
        if "price_inr" in data and data.get("name"):
            old = item.get("price_inr")
            item.pop("dimensions", None)
            item.update(data)
            item["price_status"] = "verified"
            item["last_checked"] = today
            report.append(f"OK   {item['id']}: Rs {item['price_inr']}" + ("" if old == item["price_inr"] else f" (was {old})"))
        else:
            for key in ("price_inr", "image_url", "availability", "last_checked"):
                item.pop(key, None)
            item["price_status"] = "unknown"
            if ld is not None:
                report.append(f"NOPR {item['id']}: page has no INR price; downgraded to unpriced")
        time.sleep(pause)
    for item in items:  # drop keys explicitly set to None by extract()
        for key in [k for k, v in item.items() if v is None]:
            del item[key]
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--catalog", type=Path, default=CATALOG_PATH)
    args = parser.parse_args()

    items = json.loads(args.catalog.read_text(encoding="utf-8"))
    for line in refresh(items, date.today().isoformat()):
        print(line)
    if not args.dry_run:
        args.catalog.write_text(
            "[\n" + ",\n".join("  " + json.dumps(i, ensure_ascii=False) for i in items) + "\n]\n", encoding="utf-8"
        )
        print(f"Wrote {args.catalog}")


if __name__ == "__main__":
    main()
