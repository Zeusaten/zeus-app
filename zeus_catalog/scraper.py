import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from db import init_db, upsert_product

BASE_URL = "https://new-form.it"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def clean_text(text):
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip()

def money_to_float(text):
    if not text:
        return None
    text = text.replace("€", "").replace(",", ".").strip()
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None

def parse_product(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    ld_json = {}
    ld_node = soup.select_one('script[type="application/ld+json"]')
    if ld_node and ld_node.string:
        ld_json = json.loads(ld_node.string)

    canonical = soup.select_one('link[rel="canonical"]')
    canonical_url = canonical["href"] if canonical else url

    title = clean_text(soup.select_one("h1").get_text(" ", strip=True))
    id_articolo = soup.select_one('input[name="id_articolo"]')
    id_articolo = id_articolo["value"] if id_articolo else None

    breadcrumbs = [clean_text(x.get_text(" ", strip=True)) for x in soup.select(".breadcrumb [itemprop='name']")]
    gender = breadcrumbs[1] if len(breadcrumbs) > 1 else None
    category = breadcrumbs[2] if len(breadcrumbs) > 2 else None

    current_price = money_to_float(soup.select_one(".text-danger").get_text(" ", strip=True)) if soup.select_one(".text-danger") else None
    old_price = money_to_float(soup.select_one(".text-decoration-line-through").get_text(" ", strip=True)) if soup.select_one(".text-decoration-line-through") else None

    main_img = soup.select_one("#main_img")
    main_image = urljoin(BASE_URL + "/", main_img["src"]) if main_img else None

    page_text = clean_text(soup.get_text(" ", strip=True)) or ""
    m_season = re.search(r"Collezione:\s*(.*?)\s*Codice interno:", page_text)
    season = clean_text(m_season.group(1)) if m_season else None
    m_internal = re.search(r"Codice interno:\s*(\d+)", page_text)
    internal_code = m_internal.group(1) if m_internal else None

    variants = []
    for opt in soup.select('select[name="id_variante"] option'):
        value = opt.get("value")
        if not value or value == "0":
            continue

        raw = clean_text(opt.get_text(" ", strip=True))
        size = re.sub(r"\s*\(.*?\)\s*$", "", raw).strip()
        available = opt.get("data-disp") == "1" and "terminata" not in raw.lower()

        variants.append({
            "variant_id": value,
            "size": size,
            "availability": "IN_STOCK" if available else "OUT_OF_STOCK"
        })

    availability = (ld_json.get("offers") or {}).get("availability")

    return {
        "external_id": id_articolo or ld_json.get("sku"),
        "url": canonical_url,
        "name": title or ld_json.get("name"),
        "brand": (ld_json.get("brand") or {}).get("name"),
        "gender": gender,
        "category": category,
        "sku": ld_json.get("sku"),
        "mpn": ld_json.get("mpn"),
        "color_code": ld_json.get("color"),
        "price": current_price or money_to_float((ld_json.get("offers") or {}).get("price")),
        "old_price": old_price,
        "currency": (ld_json.get("offers") or {}).get("priceCurrency"),
        "season": season,
        "internal_code": internal_code,
        "main_image": main_image,
        "availability": availability,
        "variants": variants
    }

if __name__ == "__main__":
    init_db()

    url = "https://new-form.it/t-shirt-in-cotone-strech-nero-con-braccialetto-logato-dsquared-d9m3s6210-001"
    product = parse_product(url)
    upsert_product(product)
    print("Prodotto salvato:", product["name"])