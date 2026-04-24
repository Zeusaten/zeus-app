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
OUTPUT_PATH = Path("public/catalog/demma/catalog.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120 Safari/537.36"
    )
}

# Categorie valide del sito Demma.
# Le vecchie categorie tipo /16-pannolini vanno in 404, quindi non vengono usate.
START_URLS = [
    BASE_URL,
    "https://shop.sanitariademma.it/570-acces-uomo-don-bim",
    "https://shop.sanitariademma.it/571-alimentari",
    "https://shop.sanitariademma.it/573-casalinghi",
    "https://shop.sanitariademma.it/574-corredino",
    "https://shop.sanitariademma.it/575-cosmetica",
    "https://shop.sanitariademma.it/576-detergenza-x-bimbi",
    "https://shop.sanitariademma.it/577-detersivi",
    "https://shop.sanitariademma.it/579-dietetica-x-bimbi",
    "https://shop.sanitariademma.it/581-elettricita",
    "https://shop.sanitariademma.it/582-elettro-medicali",
    "https://shop.sanitariademma.it/583-farmaceutici",
    "https://shop.sanitariademma.it/584-giocattolo",
    "https://shop.sanitariademma.it/586-linea-animali",
    "https://shop.sanitariademma.it/587-linea-premaman",
    "https://shop.sanitariademma.it/588-pannolini",
    "https://shop.sanitariademma.it/589-party",
    "https://shop.sanitariademma.it/590-profumeria-alta",
    "https://shop.sanitariademma.it/591-profumeria-bassa",
    "https://shop.sanitariademma.it/592-puericultura-leggera",
    "https://shop.sanitariademma.it/593-puericultura-pesante",
    "https://shop.sanitariademma.it/756-cancelleria",
]

CATEGORY_NAMES = {
    "acces uomo don bim",
    "accessori uomo donna bambino",
    "alimentari",
    "casalinghi",
    "corredino",
    "cosmetica",
    "detergenza x bimbi",
    "detergenza per bimbi",
    "detersivi",
    "dietetica x bimbi",
    "dietetica per bimbi",
    "elettricita",
    "elettro medicali",
    "farmaceutici",
    "giocattolo",
    "linea animali",
    "linea premaman",
    "pannolini",
    "party",
    "profumeria alta",
    "profumeria bassa",
    "puericultura leggera",
    "puericultura pesante",
    "cancelleria",
    "cordaro",
}

PRICE_RE = re.compile(r"(\d{1,4}(?:[.,]\d{1,2})?)\s*€")
AVAILABILITY_RE = re.compile(r"Availability:\s*([^\\n\\r]+)", re.I)


def clean_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_key(value):
    value = clean_text(value).lower()
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def money_to_float(value):
    if value is None:
        return None

    text = clean_text(value)
    if not text:
        return None

    text = text.replace("\xa0", " ")

    # Preferisci valori seguiti dal simbolo euro.
    euro_match = PRICE_RE.search(text)
    if euro_match:
        raw = euro_match.group(1).replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None

    matches = re.findall(r"(\d+(?:[.,]\d{1,2})?)", text)
    if not matches:
        return None

    raw = matches[-1].replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def normalize_url(href):
    return urljoin(BASE_URL + "/", href or "").split("#")[0]


def add_page_param(url, page):
    if page <= 1:
        return url

    parts = urlparse(url)
    query = parse_qs(parts.query)
    query["page"] = [str(page)]
    return urlunparse(parts._replace(query=urlencode(query, doseq=True)))


def is_internal_url(url):
    netloc = urlparse(url).netloc.lower()
    return netloc in ("shop.sanitariademma.it", "")


def is_blocked_path(path):
    blocked_prefixes = (
        "carrello",
        "ordine",
        "login",
        "my-account",
        "account",
        "contatti",
        "contact",
        "content",
        "module",
        "ricerca",
        "search",
        "categoria",
        "manufacturer",
        "supplier",
        "stores",
        "sitemap",
        "password",
        "indirizzi",
        "identita",
        "checkout",
    )
    return any(path.startswith(prefix) for prefix in blocked_prefixes)


def looks_like_category_url(url):
    if not is_internal_url(url):
        return False

    path = urlparse(url).path.strip("/").lower()
    if not path or is_blocked_path(path):
        return False

    # Categoria Prestashop: /571-alimentari
    return bool(re.fullmatch(r"\d+-[a-z0-9-]+", path))


def looks_like_product_url(url):
    if not is_internal_url(url):
        return False

    path = urlparse(url).path.strip("/").lower()
    if not path or is_blocked_path(path):
        return False

    parts = path.split("/")

    # Esclude categorie pure: /571-alimentari
    if len(parts) == 1 and re.fullmatch(r"\d+-[a-z0-9-]+", parts[0]):
        return False

    # Prodotto Prestashop:
    # /cibi-infanzia/41839-hipp-latte-combiotic-1-ml470e
    if len(parts) < 2:
        return False

    last = parts[-1]
    if not re.match(r"^\d+-[a-z0-9-]+", last):
        return False

    slug = re.sub(r"^\d+-", "", last)
    slug_tokens = [x for x in slug.split("-") if x]

    return len(slug_tokens) >= 2


def get_html(url):
    response = requests.get(url, headers=HEADERS, timeout=45)
    response.raise_for_status()
    return response.text


def guess_category_from_url(url):
    path = urlparse(url).path.strip("/")
    if not path:
        return ""

    last = path.split("/")[-1]
    slug = re.sub(r"^\d+-", "", last)
    slug = slug.replace("-", " ")
    return clean_text(slug).title()


def extract_category_links(html):
    soup = BeautifulSoup(html, "lxml")
    links = set()

    for a in soup.select("a[href]"):
        href = normalize_url(a.get("href"))
        if looks_like_category_url(href):
            links.add(href)

    return sorted(links)


def get_product_name_from_anchor(a):
    text = clean_text(a.get_text(" ", strip=True))

    # Le immagini spesso hanno alt/title utile.
    if not text:
        img = a.select_one("img")
        if img:
            text = clean_text(img.get("alt") or img.get("title") or "")

    if not text:
        text = clean_text(a.get("title") or a.get("aria-label") or "")

    return text


def get_product_links_from_page(html):
    soup = BeautifulSoup(html, "lxml")
    found = {}

    for a in soup.select("a[href]"):
        href = normalize_url(a.get("href"))
        if not looks_like_product_url(href):
            continue

        name = get_product_name_from_anchor(a)

        # Se il link è solo immagine e non porta nome, lo lasciamo comunque:
        # parse_product_page proverà a leggere la pagina prodotto.
        if href not in found:
            found[href] = name

        # Se una occorrenza successiva ha un nome migliore, usa quella.
        if name and len(name) > len(found.get(href) or ""):
            found[href] = name

    return found


def find_best_context_node(a):
    # Cerca un contenitore prodotto, ma evita di salire fino all'intera pagina.
    for parent in a.parents:
        if not getattr(parent, "name", None):
            continue

        classes = " ".join(parent.get("class", []))
        parent_id = parent.get("id", "")

        if any(
            token in classes.lower() or token in parent_id.lower()
            for token in [
                "product-miniature",
                "js-product-miniature",
                "thumbnail-container",
                "product-container",
                "ajax_block_product",
                "product",
            ]
        ):
            return parent

        if parent.name in ("article", "li"):
            return parent

    return a.parent or a


def extract_image_near_anchor(a):
    context = find_best_context_node(a)

    img = context.select_one("img") if context else None
    if not img:
        img = a.select_one("img")

    if not img:
        return ""

    image = (
        img.get("data-full-size-image-url")
        or img.get("data-src")
        or img.get("src")
        or ""
    )

    return normalize_url(image) if image else ""


def extract_price_near_anchor(a):
    context = find_best_context_node(a)
    text = clean_text(context.get_text(" ", strip=True)) if context else ""

    price = money_to_float(text)
    if price is not None:
        return price

    # Fallback: controlla qualche fratello successivo.
    pieces = []
    for sib in list(a.next_siblings)[:8]:
        if getattr(sib, "get_text", None):
            pieces.append(sib.get_text(" ", strip=True))
        else:
            pieces.append(str(sib))

    return money_to_float(" ".join(pieces))


def extract_availability_near_anchor(a):
    context = find_best_context_node(a)
    text = clean_text(context.get_text(" ", strip=True)) if context else ""

    lower = text.lower()

    if "out of stock" in lower or "non disponibile" in lower:
        return "OUT_OF_STOCK"

    if "in stock" in lower or "in magazzino" in lower or "disponibile" in lower:
        return "IN_STOCK"

    return "IN_STOCK"


def parse_listing_products(html, source_url):
    soup = BeautifulSoup(html, "lxml")
    products = []

    seen = set()

    for a in soup.select("a[href]"):
        url = normalize_url(a.get("href"))

        if not looks_like_product_url(url):
            continue

        if url in seen:
            continue

        name = get_product_name_from_anchor(a)

        if not name:
            continue

        if normalize_key(name) in CATEGORY_NAMES:
            continue

        # Evita link di navigazione o azioni.
        bad_names = {"wishlist", "compare", "anteprima", "nuovo", "aggiungi al carrello"}
        if normalize_key(name) in bad_names:
            continue

        seen.add(url)

        products.append(
            {
                "id": url,
                "external_id": url,
                "url": url,
                "name": name,
                "brand": "",
                "category": guess_category_from_url(source_url),
                "gender": "",
                "price": extract_price_near_anchor(a),
                "old_price": None,
                "currency": "EUR",
                "main_image": extract_image_near_anchor(a),
                "availability": extract_availability_near_anchor(a),
                "variants": [],
                "available_sizes": [],
                "source": "demma",
            }
        )

    return products


def parse_json_ld_product(soup, url, fallback_category):
    for node in soup.select('script[type="application/ld+json"]'):
        raw = node.string or node.get_text()
        if not raw:
            continue

        try:
            data = json.loads(raw)
        except Exception:
            continue

        candidates = data if isinstance(data, list) else [data]

        for item in candidates:
            if not isinstance(item, dict):
                continue

            item_type = item.get("@type")
            is_product = item_type == "Product" or (
                isinstance(item_type, list) and "Product" in item_type
            )

            if not is_product:
                continue

            offers = item.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}

            brand = item.get("brand") or ""
            if isinstance(brand, dict):
                brand = brand.get("name") or ""

            image = item.get("image") or ""
            if isinstance(image, list):
                image = image[0] if image else ""

            availability_raw = str(offers.get("availability") or "").lower()
            availability = (
                "OUT_OF_STOCK" if "outofstock" in availability_raw else "IN_STOCK"
            )

            name = clean_text(item.get("name") or "")
            if not name or normalize_key(name) in CATEGORY_NAMES:
                return None

            return {
                "id": url,
                "external_id": item.get("sku") or url,
                "url": url,
                "name": name,
                "brand": clean_text(brand),
                "category": fallback_category,
                "gender": "",
                "price": money_to_float(offers.get("price")),
                "old_price": None,
                "currency": offers.get("priceCurrency") or "EUR",
                "main_image": normalize_url(image) if image else "",
                "availability": availability,
                "variants": [],
                "available_sizes": [],
                "source": "demma",
            }

    return None


def parse_product_page(url, fallback_category="", fallback_name=""):
    html = get_html(url)
    soup = BeautifulSoup(html, "lxml")

    json_product = parse_json_ld_product(soup, url, fallback_category)
    if json_product and json_product.get("name"):
        return json_product

    name_node = (
        soup.select_one("h1")
        or soup.select_one(".h1")
        or soup.select_one("[itemprop='name']")
        or soup.select_one("title")
    )

    name = clean_text(name_node.get_text(" ", strip=True)) if name_node else ""
    if not name:
        name = fallback_name

    if not name:
        return None

    if normalize_key(name) in CATEGORY_NAMES:
        return None

    price_node = (
        soup.select_one(".current-price .price")
        or soup.select_one(".product-price")
        or soup.select_one(".price")
        or soup.select_one("[itemprop='price']")
    )

    old_price_node = (
        soup.select_one(".regular-price")
        or soup.select_one(".old-price")
        or soup.select_one(".price-old")
    )

    img = (
        soup.select_one(".product-cover img")
        or soup.select_one("[itemprop='image']")
        or soup.select_one("img")
    )

    image = ""
    if img:
        image = (
            img.get("data-full-size-image-url")
            or img.get("data-src")
            or img.get("src")
            or ""
        )
        image = normalize_url(image)

    breadcrumbs = [
        clean_text(x.get_text(" ", strip=True))
        for x in soup.select(".breadcrumb a, .breadcrumb span, nav.breadcrumb li")
        if clean_text(x.get_text(" ", strip=True))
    ]

    category = fallback_category
    if len(breadcrumbs) >= 2:
        category = breadcrumbs[-2]

    text = clean_text(soup.get_text(" ", strip=True)).lower()
    availability = "IN_STOCK"
    if "out of stock" in text or "non disponibile" in text:
        availability = "OUT_OF_STOCK"

    return {
        "id": url,
        "external_id": url,
        "url": url,
        "name": name,
        "brand": "",
        "category": category or "",
        "gender": "",
        "price": money_to_float(price_node.get_text(" ", strip=True)) if price_node else None,
        "old_price": money_to_float(old_price_node.get_text(" ", strip=True)) if old_price_node else None,
        "currency": "EUR",
        "main_image": image,
        "availability": availability,
        "variants": [],
        "available_sizes": [],
        "source": "demma",
    }


def unique_products(products):
    out = {}

    for product in products:
        url = product.get("url")
        name = clean_text(product.get("name"))

        if not url or not name:
            continue

        if normalize_key(name) in CATEGORY_NAMES:
            continue

        out[url] = product

    return list(out.values())


def sync(limit_per_category=None, max_pages=2, sleep_seconds=0.2):
    all_products = []
    category_urls = set(START_URLS)

    print("[INFO] Leggo homepage e categorie iniziali...")

    try:
        homepage = get_html(BASE_URL)
        category_urls.update(extract_category_links(homepage))
        all_products.extend(parse_listing_products(homepage, BASE_URL))
    except Exception as exc:
        print(f"[WARN] Homepage non letta: {exc}")

    category_urls = sorted(category_urls)
    print(f"[INFO] Categorie da leggere: {len(category_urls)}")

    for index, category_url in enumerate(category_urls, start=1):
        print(f"\n[{index}/{len(category_urls)}] Categoria: {category_url}")

        for page in range(1, max_pages + 1):
            page_url = add_page_param(category_url, page)

            try:
                html = get_html(page_url)
            except Exception as exc:
                print(f"  [WARN] Pagina non letta: {page_url} -> {exc}")
                break

            listing_products = parse_listing_products(html, category_url)
            link_map = get_product_links_from_page(html)

            link_items = list(link_map.items())
            if limit_per_category:
                link_items = link_items[:limit_per_category]

            print(
                f"  Pagina {page}: {len(listing_products)} prodotti letti dalla lista, "
                f"{len(link_items)} link prodotto da verificare"
            )

            for product in listing_products:
                all_products.append(product)
                print(f"    + {product['name'][:80]}")

            for product_url, fallback_name in link_items:
                try:
                    product = parse_product_page(
                        product_url,
                        fallback_category=guess_category_from_url(category_url),
                        fallback_name=fallback_name,
                    )

                    if product:
                        all_products.append(product)
                        print(f"    + {product['name'][:80]}")

                except Exception as exc:
                    print(f"    [WARN] Prodotto saltato: {product_url} -> {exc}")

                if sleep_seconds:
                    time.sleep(sleep_seconds)

            if not listing_products and not link_items:
                break

        if sleep_seconds:
            time.sleep(sleep_seconds)

    products = unique_products(all_products)
    products.sort(key=lambda p: (p.get("category") or "", p.get("name") or ""))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "shop.sanitariademma.it",
        "count": len(products),
        "products": products,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"\n[OK] Salvato catalogo Demma: {OUTPUT_PATH}")
    print(f"[OK] Prodotti esportati: {len(products)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-per-category", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--sleep", type=float, default=0.2)

    args = parser.parse_args()

    sync(
        limit_per_category=args.limit_per_category,
        max_pages=args.max_pages,
        sleep_seconds=args.sleep,
    )
