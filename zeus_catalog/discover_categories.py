import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

BASE_URL = "https://new-form.it"
HEADERS = {"User-Agent": "Mozilla/5.0"}

TOP_LEVELS = [
    "https://new-form.it/uomo",
    "https://new-form.it/donna",
    "https://new-form.it/bambino",
    "https://new-form.it/bambina",
]

BLOCKED = {
    "",
    "carrello",
    "profilo",
    "acquisti",
    "privacy",
    "condizioni_vendita",
    "logout.php",
    "modifica-password",
    "cerca",
}


def normalize_url(href: str) -> str:
    return urljoin(BASE_URL + "/", href).split("#")[0]


def is_internal(url: str) -> bool:
    netloc = urlparse(url).netloc.lower()
    return netloc in ("", "new-form.it", "www.new-form.it")


def looks_like_category(url: str) -> bool:
    if not is_internal(url):
        return False

    path = urlparse(url).path.strip("/").lower()
    if not path or path in BLOCKED:
        return False

    if path.startswith(("articoli/", "immagini/", "fonts/")):
        return False

    # prodotti di solito hanno slug molto lunghi
    if path.count("-") >= 4:
        return False

    roots = ("uomo", "donna", "bambino", "bambina")
    return path.startswith(roots)


def discover_categories() -> list[str]:
    found = set()

    for url in TOP_LEVELS:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        for a in soup.select("a[href]"):
            href = normalize_url(a["href"])
            if looks_like_category(href):
                found.add(href)

        # includi anche la root stessa
        found.add(url)

    return sorted(found)


if __name__ == "__main__":
    cats = discover_categories()
    print(f"Trovate {len(cats)} categorie")
    for c in cats:
        print(c)