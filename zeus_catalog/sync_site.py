import argparse
import time

from db import init_db
from discover_categories import discover_categories
from category_scraper import scrape_category


def run_sync(limit_per_category=None, sleep_seconds=1.5):
    init_db()

    categories = discover_categories()
    print(f"\n[SYNC] Categorie trovate: {len(categories)}\n")

    ok = 0
    ko = 0

    for idx, category in enumerate(categories, start=1):
        print("=" * 80)
        print(f"[SYNC] Categoria {idx}/{len(categories)}: {category}")
        print("=" * 80)

        try:
            scrape_category(category, limit=limit_per_category)
            ok += 1
        except Exception as exc:
            print(f"[ERRORE] {category}")
            print(exc)
            ko += 1

        if idx < len(categories):
            time.sleep(sleep_seconds)

    print("\n" + "=" * 80)
    print("[SYNC COMPLETATO]")
    print(f"Categorie OK: {ok}")
    print(f"Categorie KO: {ko}")
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-per-category", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=1.5)
    args = parser.parse_args()

    run_sync(
        limit_per_category=args.limit_per_category,
        sleep_seconds=args.sleep,
    )