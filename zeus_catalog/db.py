import os
import sqlite3
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL")
SQLITE_PATH = os.getenv("SQLITE_PATH", "catalog.db")


def is_postgres():
    return bool(DATABASE_URL and DATABASE_URL.startswith("postgres"))


def get_conn():
    if is_postgres():
        import psycopg
        conn = psycopg.connect(DATABASE_URL)
        conn.row_factory = psycopg.rows.dict_row
        return conn

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    if is_postgres():
        cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            external_id TEXT UNIQUE,
            url TEXT UNIQUE,
            name TEXT,
            brand TEXT,
            gender TEXT,
            category TEXT,
            sku TEXT,
            mpn TEXT,
            color_code TEXT,
            price DOUBLE PRECISION,
            old_price DOUBLE PRECISION,
            currency TEXT,
            season TEXT,
            internal_code TEXT,
            main_image TEXT,
            availability TEXT
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS variants (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
            external_variant_id TEXT,
            size TEXT,
            availability TEXT,
            UNIQUE(product_id, external_variant_id)
        )
        """)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            external_id TEXT UNIQUE,
            url TEXT UNIQUE,
            name TEXT,
            brand TEXT,
            gender TEXT,
            category TEXT,
            sku TEXT,
            mpn TEXT,
            color_code TEXT,
            price REAL,
            old_price REAL,
            currency TEXT,
            season TEXT,
            internal_code TEXT,
            main_image TEXT,
            availability TEXT
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            external_variant_id TEXT,
            size TEXT,
            availability TEXT,
            UNIQUE(product_id, external_variant_id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
        """)

    conn.commit()
    conn.close()


def upsert_product(product: dict):
    conn = get_conn()
    cur = conn.cursor()

    if is_postgres():
        cur.execute("""
        INSERT INTO products (
            external_id, url, name, brand, gender, category, sku, mpn,
            color_code, price, old_price, currency, season, internal_code,
            main_image, availability
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (url) DO UPDATE SET
            external_id = EXCLUDED.external_id,
            name = EXCLUDED.name,
            brand = EXCLUDED.brand,
            gender = EXCLUDED.gender,
            category = EXCLUDED.category,
            sku = EXCLUDED.sku,
            mpn = EXCLUDED.mpn,
            color_code = EXCLUDED.color_code,
            price = EXCLUDED.price,
            old_price = EXCLUDED.old_price,
            currency = EXCLUDED.currency,
            season = EXCLUDED.season,
            internal_code = EXCLUDED.internal_code,
            main_image = EXCLUDED.main_image,
            availability = EXCLUDED.availability
        """, (
            product.get("external_id"),
            product.get("url"),
            product.get("name"),
            product.get("brand"),
            product.get("gender"),
            product.get("category"),
            product.get("sku"),
            product.get("mpn"),
            product.get("color_code"),
            product.get("price"),
            product.get("old_price"),
            product.get("currency"),
            product.get("season"),
            product.get("internal_code"),
            product.get("main_image"),
            product.get("availability"),
        ))
        cur.execute("SELECT id FROM products WHERE url = %s", (product.get("url"),))
        product_id = cur.fetchone()["id"]
        cur.execute("DELETE FROM variants WHERE product_id = %s", (product_id,))
        for v in product.get("variants", []):
            cur.execute("""
            INSERT INTO variants (product_id, external_variant_id, size, availability)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (product_id, external_variant_id) DO UPDATE SET
                size = EXCLUDED.size,
                availability = EXCLUDED.availability
            """, (
                product_id,
                v.get("variant_id"),
                v.get("size"),
                v.get("availability"),
            ))
    else:
        cur.execute("""
        INSERT INTO products (
            external_id, url, name, brand, gender, category, sku, mpn,
            color_code, price, old_price, currency, season, internal_code,
            main_image, availability
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
            external_id=excluded.external_id,
            name=excluded.name,
            brand=excluded.brand,
            gender=excluded.gender,
            category=excluded.category,
            sku=excluded.sku,
            mpn=excluded.mpn,
            color_code=excluded.color_code,
            price=excluded.price,
            old_price=excluded.old_price,
            currency=excluded.currency,
            season=excluded.season,
            internal_code=excluded.internal_code,
            main_image=excluded.main_image,
            availability=excluded.availability
        """, (
            product.get("external_id"),
            product.get("url"),
            product.get("name"),
            product.get("brand"),
            product.get("gender"),
            product.get("category"),
            product.get("sku"),
            product.get("mpn"),
            product.get("color_code"),
            product.get("price"),
            product.get("old_price"),
            product.get("currency"),
            product.get("season"),
            product.get("internal_code"),
            product.get("main_image"),
            product.get("availability"),
        ))
        cur.execute("SELECT id FROM products WHERE url = ?", (product.get("url"),))
        product_id = cur.fetchone()["id"]
        cur.execute("DELETE FROM variants WHERE product_id = ?", (product_id,))
        for v in product.get("variants", []):
            cur.execute("""
            INSERT INTO variants (product_id, external_variant_id, size, availability)
            VALUES (?, ?, ?, ?)
            """, (
                product_id,
                v.get("variant_id"),
                v.get("size"),
                v.get("availability"),
            ))

    conn.commit()
    conn.close()