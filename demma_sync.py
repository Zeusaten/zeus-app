import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://shop.sanitariademma.it"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}

DEFAULT_CATEGORY_URLS = [
    "https://shop.sanitariademma.it/570-accessori-uomo-donna-bambino",
    "https://shop.sanitariademma.it/571-alimentari",
    "https://shop.sanitariademma.it/572-casalinghi",
    "https://shop.sanitariademma.it/574-corredino",
    "https://shop.sanitariademma.it/575-cosmetica",
    "https://shop.sanitariademma.it/576-detergenza-per-bimbi",
    "https://shop.sanitariademma.it/577-detersivi",
    "https://shop.sanitariademma.it/578-dolciumi-e-bibite",
    "https://shop.sanitariademma.it/579-farmaceutici",
    "https://shop.sanitariademma.it/580-giocattolo",
    "https://shop.sanitariademma.it/581-linea-animali",
    "https://shop.sanitariademma.it/582-linea-premaman",
    "https://shop.sanitariademma.it/588-pannolini",
    "https://shop.sanitariademma.it/589-profumeria-alta",
    "https://shop.sanitariademma.it/590-profumeria-bassa",
    "https://shop.sanitariademma.it/591-puericultura-leggera",
    "https://shop.sanitariademma.it/592-puericultura-pesante",
    "https://shop.sanitariademma.it/609-dietetica-per-bimbi",
    "https://shop.sanitariademma.it/645-elettro-medicali",
    "https://shop.sanitariademma.it/662-cancelleria",
    "https://shop.sanitariademma.it/669-elettricita",
    "https://shop.sanitariademma.it/702-party",
]

OUTPUT_PATH = Path("public/catalog/demma/catalog.json")


def clean_text(value):
    if not value:
        return None
    return re.sub(r"\s+", " ", value).strip()


def money_to_float(value):
    if not value:
        return None
    text = clean_text(value)
    if not text:
        return None
    text = text.replace("€", "").replace("\xa0", " ").replace(".", "").replace(",", ".")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", text)
    return float(match.group(1)) if match else None


def normalize_url(href):
    return urljoin(BASE_URL + "/", href).split("#")[0]


def is_internal(url):
    host = urlparse(url).netloc.lower()
    return host in ("", "shop.sanitariademma.it")


def looks_like_product_url(url):
    if not is_internal(url):
        return False
    path = urlparse(url).path.lower()
    return path.endswith(".html") and re.search(r"/\d+[-/]", path)


def add_page_param(url, page):
    parts = urlparse(url)
    query = parse_qs(parts.query)
    query["page"] = [str(page)]
    return urlunparse(parts._replace(query=urlencode(query, doseq=True)))


def fetch(url):
    response = requests.get(url, headers=HEADERS, timeout=35)
    response.raise_for_status()
    return response.text


def extract_product_links(html):
    soup = BeautifulSoup(html, "lxml")
    links = set()

    selectors = [
        "article.product-miniature a.thumbnail",
        ".js-product-miniature a.thumbnail",
        ".product-miniature a.thumbnail",
        "h2.product-title a[href]",
        "h3.product-title a[href]",
        ".product-description a[href]",
        "a[href]",
    ]

    for selector in selectors:
        for a in soup.select(selector):
            href = a.get("href")
            if not href:
                continue
            url = normalize_url(href)
            if looks_like_product_url(url):
                links.add(url)

    return sorted(links)


def extract_next_page(html):
    soup = BeautifulSoup(html, "lxml")

    rel_next = soup.select_one('link[rel="next"]')
    if rel_next and rel_next.get("href"):
        return normalize_url(rel_next["href"])

    for a in soup.select("a[href]"):
        label = clean_text(a.get_text(" ", strip=True)) or ""
        if "successivo" in label.lower() or "next" in label.lower():
            return normalize_url(a["href"])

    return None


def extract_links_from_category(category_url, max_pages=30):
    links = set()
    page_url = category_url

    for page in range(1, max_pages + 1):
        print(f"[CAT] pagina {page}: {page_url}")
        html = fetch(page_url)
        page_links = extract_product_links(html)

        before = len(links)
        links.update(page_links)
        print(f"      trovati {len(page_links)} link, totale {len(links)}")

        if len(links) == before and page > 1:
            break

        next_page = extract_next_page(html)
        if not next_page:
            guessed = add_page_param(category_url, page + 1)
            if guessed == page_url:
                break
            next_page = guessed

        if next_page == page_url:
            break
        page_url = next_page

    return sorted(links)


def parse_json_ld(soup):
    for node in soup.select('script[type="application/ld+json"]'):
        raw = node.string or node.get_text(" ", strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("@type") == "Product":
                    return item
        elif isinstance(data, dict):
            if data.get("@type") == "Product":
                return data
            graph = data.get("@graph")
            if isinstance(graph, list):
                for item in graph:
                    if isinstance(item, dict) and item.get("@type") == "Product":
                        return item
    return {}


def first_text(soup, selectors):
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                return text
    return None


def first_attr(soup, selectors, attr):
    for selector in selectors:
        node = soup.select_one(selector)
        if node and node.get(attr):
            return normalize_url(node[attr])
    return None


def parse_product(url, category_hint=None):
    html = fetch(url)
    soup = BeautifulSoup(html, "lxml")
    ld = parse_json_ld(soup)

    name = (
        first_text(soup, ["h1", ".h1", ".product-name", "[itemprop='name']"])
        or clean_text(ld.get("name"))
    )

    canonical = soup.select_one('link[rel="canonical"]')
    canonical_url = normalize_url(canonical["href"]) if canonical and canonical.get("href") else url

    breadcrumbs = [
        clean_text(x.get_text(" ", strip=True))
        for x in soup.select(".breadcrumb li, .breadcrumb [itemprop='name'], nav.breadcrumb a")
    ]
    breadcrumbs = [x for x in breadcrumbs if x and x.lower() not in ("home",)]

    category = category_hint
    if len(breadcrumbs) >= 2:
        category = breadcrumbs[-2]
    elif breadcrumbs:
        category = breadcrumbs[0]

    price = None
    offers = ld.get("offers") if isinstance(ld.get("offers"), dict) else {}
    if offers:
        price = money_to_float(str(offers.get("price") or ""))

    if price is None:
        price = money_to_float(first_text(soup, [
            ".current-price span", ".current-price", "[itemprop='price']", ".price", ".product-price"
        ]))

    old_price = money_to_float(first_text(soup, [
        ".regular-price", ".product-discount .regular-price", ".old-price", ".price-old"
    ]))

    main_image = (
        first_attr(soup, [".product-cover img", "[itemprop='image']", "meta[property='og:image']"], "src")
        or first_attr(soup, ["meta[property='og:image']"], "content")
    )

    page_text = clean_text(soup.get_text(" ", strip=True)) or ""

    available_quantity = None
    qty_match = re.search(r"Availability:\s*(\d+)\s+In Stock", page_text, re.I)
    if qty_match:
        available_quantity = int(qty_match.group(1))

    is_out = "non disponibile" in page_text.lower() or "out of stock" in page_text.lower()
    is_in = "in stock" in page_text.lower() or "aggiungi al carrello" in page_text.lower()
    availability = "OUT_OF_STOCK" if is_out and not is_in else "IN_STOCK" if is_in else None

    reference = None
    ref_match = re.search(r"Riferimento\s+([A-Za-z0-9._/-]+)", page_text)
    if ref_match:
        reference = ref_match.group(1)

    brand = None
    brand_data = ld.get("brand")
    if isinstance(brand_data, dict):
        brand = brand_data.get("name")
    elif isinstance(brand_data, str):
        brand = brand_data

    if not brand and name:
        # utile per ricerche tipo Humana, Mellin, Pampers, Huggies
        brand = name.split(" ", 1)[0].strip()

    return {
        "id": reference or canonical_url,
        "external_id": reference,
        "url": canonical_url,
        "name": name,
        "brand": brand,
        "category": category,
        "gender": None,
        "audience": None,
        "price": price,
        "old_price": old_price,
        "currency": "EUR",
        "main_image": main_image,
        "availability": availability,
        "available_quantity": available_quantity,
        "available_sizes": [],
        "variants": [],
        "description": first_text(soup, [".product-description", "#description", "[itemprop='description']"]),
        "catalog_key": "demma",
        "catalog_name": "Sanitaria Demma",
    }


def sync(categories, limit_per_category=None, max_pages=30, sleep_seconds=0.6):
    all_links = []
    seen = set()

    for category_url in categories:
        try:
            links = extract_links_from_category(category_url, max_pages=max_pages)
            if limit_per_category:
                links = links[:limit_per_category]
            category_name = urlparse(category_url).path.rsplit("-", 1)[-1].replace("-", " ").title()
            for link in links:
                if link not in seen:
                    seen.add(link)
                    all_links.append((link, category_name))
        except Exception as exc:
            print(f"[ERRORE CATEGORIA] {category_url}: {exc}")

    products = []
    errors = 0

    for index, (url, category_hint) in enumerate(all_links, start=1):
        try:
            print(f"[PROD {index}/{len(all_links)}] {url}")
            product = parse_product(url, category_hint=category_hint)
            if product.get("name"):
                products.append(product)
        except Exception as exc:
            errors += 1
            print(f"    ERRORE: {exc}")
        if sleep_seconds:
            time.sleep(sleep_seconds)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": BASE_URL,
        "count": len(products),
        "errors": errors,
        "products": products,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[OK] Salvato {len(products)} prodotti in {OUTPUT_PATH}")
    print(f"[INFO] Errori prodotti: {errors}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sincronizza il catalogo Sanitaria Demma in JSON statico")
    parser.add_argument("--limit-per-category", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=30)
    parser.add_argument("--sleep", type=float, default=0.6)
    parser.add_argument("--category", action="append", dest="categories")
    args = parser.parse_args()

    selected_categories = args.categories if args.categories else DEFAULT_CATEGORY_URLS
    sync(
        selected_categories,
        limit_per_category=args.limit_per_category,
        max_pages=args.max_pages,
        sleep_seconds=args.sleep,
    )
