import argparse
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup

from db import init_db, upsert_product
from scraper import parse_product, BASE_URL, HEADERS


def normalize_url(href: str) -> str:
    url = urljoin(BASE_URL + "/", href)
    return url.split("#")[0]


def is_internal_newform(url: str) -> bool:
    netloc = urlparse(url).netloc.lower()
    return netloc in ("", "new-form.it", "www.new-form.it")


def looks_like_product_link(url: str) -> bool:
    if not is_internal_newform(url):
        return False

    path = urlparse(url).path.strip("/").lower()
    if not path:
        return False

    blocked_prefixes = ("articoli/", "immagini/", "fonts/")
    blocked_exact = {
        "uomo", "donna", "bambino", "bambina", "carrello",
        "profilo", "acquisti", "privacy", "condizioni_vendita",
        "modifica-password", "logout.php", "cerca"
    }

    if path.startswith(blocked_prefixes):
        return False
    if path in blocked_exact:
        return False
    if "." in path and not path.endswith(".php"):
        return False

    return path.count("-") >= 4


def add_page_param(url: str, page: int) -> str:
    parts = urlparse(url)
    query = parse_qs(parts.query)
    query["page"] = [str(page)]
    new_query = urlencode(query, doseq=True)
    return urlunparse(parts._replace(query=new_query))


def extract_product_links_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    found = set()

    for a in soup.select("a.shop-item-image[href]"):
        found.add(normalize_url(a["href"]))

    for img in soup.select("img.img_ricerca"):
        a = img.find_parent("a", href=True)
        if a:
            found.add(normalize_url(a["href"]))

    for a in soup.select("a[href]"):
        href = normalize_url(a["href"])
        if looks_like_product_link(href):
            found.add(href)

    return sorted(found)


def extract_product_links(category_url: str, max_pages: int = 20) -> list[str]:
    all_links = set()

    for page in range(1, max_pages + 1):
        page_url = category_url if page == 1 else add_page_param(category_url, page)
        r = requests.get(page_url, headers=HEADERS, timeout=30)
        r.raise_for_status()

        links = extract_product_links_from_html(r.text)
        if not links:
            break

        before = len(all_links)
        all_links.update(links)

        # se una pagina non aggiunge nulla di nuovo, fermati
        if len(all_links) == before:
            break

    return sorted(all_links)


def scrape_category(category_url: str, limit: int | None = None):
    print(f"\n[INFO] Leggo categoria: {category_url}")
    links = extract_product_links(category_url)
    print(f"[INFO] Trovati {len(links)} link prodotto candidati")

    if limit is not None:
        links = links[:limit]
        print(f"[INFO] Limite attivo: processerò i primi {len(links)}")

    saved = 0
    errors = 0

    for i, url in enumerate(links, start=1):
        try:
            print(f"[{i}/{len(links)}] Parsing {url}")
            product = parse_product(url)
            upsert_product(product)
            print(f"    -> salvato: {product.get('name')}")
            saved += 1
        except Exception as e:
            print(f"    -> ERRORE: {e}")
            errors += 1

    print("\n[RESULT]")
    print(f"Salvati: {saved}")
    print(f"Errori: {errors}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape di una categoria New Form e salvataggio prodotti nel DB")
    parser.add_argument("category_url", help="URL della categoria")
    parser.add_argument("--limit", type=int, default=None, help="Numero massimo di prodotti da processare")
    args = parser.parse_args()

    init_db()
    scrape_category(args.category_url, limit=args.limit)