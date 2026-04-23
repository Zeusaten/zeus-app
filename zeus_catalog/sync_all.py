import argparse
import time

from db import init_db
from category_scraper import scrape_category

DEFAULT_CATEGORIES = [
    "https://new-form.it/uomo-tshirt",
    "https://new-form.it/uomo-pantaloni",
    "https://new-form.it/donna-tshirt",
    "https://new-form.it/uomo-tshirt-dsquared",
]


def run_sync(categories: list[str], limit_per_category: int | None = None, sleep_seconds: float = 1.5):
    init_db()

    total_categories = len(categories)
    total_ok = 0
    total_errors = 0

    print(f"\n[SYNC] Avvio sincronizzazione di {total_categories} categorie\n")

    for index, category_url in enumerate(categories, start=1):
        print("=" * 80)
        print(f"[SYNC] Categoria {index}/{total_categories}: {category_url}")
        print("=" * 80)

        try:
            scrape_category(category_url, limit=limit_per_category)
            total_ok += 1
        except Exception as exc:
            total_errors += 1
            print(f"[ERRORE CATEGORIA] {category_url}")
            print(exc)

        if index < total_categories and sleep_seconds > 0:
            print(f"\n[WAIT] Pausa di {sleep_seconds} secondi...\n")
            time.sleep(sleep_seconds)

    print("\n" + "=" * 80)
    print("[SYNC COMPLETATO]")
    print(f"Categorie processate con successo: {total_ok}")
    print(f"Categorie con errore: {total_errors}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sincronizza più categorie New Form nel database locale"
    )

    parser.add_argument(
        "--limit-per-category",
        type=int,
        default=None,
        help="Numero massimo di prodotti per categoria",
    )

    parser.add_argument(
        "--sleep",
        type=float,
        default=1.5,
        help="Secondi di pausa tra una categoria e l'altra",
    )

    parser.add_argument(
        "--category",
        action="append",
        dest="categories",
        help="Categoria specifica da sincronizzare. Puoi passarlo più volte.",
    )

    args = parser.parse_args()

    categories = args.categories if args.categories else DEFAULT_CATEGORIES

    run_sync(
        categories=categories,
        limit_per_category=args.limit_per_category,
        sleep_seconds=args.sleep,
    )