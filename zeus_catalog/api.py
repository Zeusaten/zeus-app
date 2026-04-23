from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from db import get_conn

app = FastAPI(title="Zeus Catalog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_product_variants_map(product_ids: list[int]) -> dict[int, list[dict]]:
    if not product_ids:
        return {}

    conn = get_conn()
    cur = conn.cursor()

    placeholders = ",".join("?" for _ in product_ids)
    rows = cur.execute(
        f"""
        SELECT product_id, external_variant_id, size, availability
        FROM variants
        WHERE product_id IN ({placeholders})
        ORDER BY size
        """,
        product_ids,
    ).fetchall()
    conn.close()

    out = {}
    for row in rows:
        row_dict = dict(row)
        pid = row_dict["product_id"]
        out.setdefault(pid, []).append(
            {
                "external_variant_id": row_dict["external_variant_id"],
                "size": row_dict["size"],
                "availability": row_dict["availability"],
            }
        )
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/products/search")
def search_products(
    brand: str | None = None,
    category: str | None = None,
    gender: str | None = None,
    size: str | None = None,
    availability: str | None = None,
    color: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    q: str | None = Query(default=None),
):
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        p.id,
        p.name,
        p.brand,
        p.category,
        p.gender,
        p.price,
        p.old_price,
        p.url,
        p.main_image
    FROM products p
    WHERE 1=1
    """
    params = []

    if brand:
        sql += " AND lower(p.brand) = lower(?)"
        params.append(brand)

    if category:
        sql += " AND lower(p.category) = lower(?)"
        params.append(category)

    if gender:
        sql += " AND lower(p.gender) = lower(?)"
        params.append(gender)

    if q:
        sql += " AND lower(p.name) LIKE lower(?)"
        params.append(f"%{q}%")

    if color:
        sql += " AND lower(p.name) LIKE lower(?)"
        params.append(f"%{color}%")

    if min_price is not None:
        sql += " AND p.price >= ?"
        params.append(min_price)

    if max_price is not None:
        sql += " AND p.price <= ?"
        params.append(max_price)

    if size or availability:
        sql += """
        AND EXISTS (
            SELECT 1
            FROM variants v
            WHERE v.product_id = p.id
        """
        if size:
            sql += " AND lower(v.size) = lower(?)"
            params.append(size)
        if availability:
            sql += " AND lower(v.availability) = lower(?)"
            params.append(availability)
        sql += ")"

    sql += " ORDER BY p.brand, p.name"

    rows = cur.execute(sql, params).fetchall()
    conn.close()

    return [dict(r) for r in rows]


@app.get("/products/search_full")
def search_products_full(
    brand: str | None = None,
    category: str | None = None,
    gender: str | None = None,
    size: str | None = None,
    availability: str | None = None,
    color: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    q: str | None = Query(default=None),
):
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        p.id,
        p.name,
        p.brand,
        p.category,
        p.gender,
        p.price,
        p.old_price,
        p.url,
        p.main_image,
        p.color_code,
        p.season
    FROM products p
    WHERE 1=1
    """
    params = []

    if brand:
        sql += " AND lower(p.brand) = lower(?)"
        params.append(brand)

    if category:
        sql += " AND lower(p.category) = lower(?)"
        params.append(category)

    if gender:
        sql += " AND lower(p.gender) = lower(?)"
        params.append(gender)

    if q:
        sql += " AND lower(p.name) LIKE lower(?)"
        params.append(f"%{q}%")

    if color:
        sql += " AND lower(p.name) LIKE lower(?)"
        params.append(f"%{color}%")

    if min_price is not None:
        sql += " AND p.price >= ?"
        params.append(min_price)

    if max_price is not None:
        sql += " AND p.price <= ?"
        params.append(max_price)

    if size or availability:
        sql += """
        AND EXISTS (
            SELECT 1
            FROM variants v
            WHERE v.product_id = p.id
        """
        if size:
            sql += " AND lower(v.size) = lower(?)"
            params.append(size)
        if availability:
            sql += " AND lower(v.availability) = lower(?)"
            params.append(availability)
        sql += ")"

    sql += " ORDER BY p.brand, p.name"

    products = [dict(r) for r in cur.execute(sql, params).fetchall()]
    conn.close()

    product_ids = [p["id"] for p in products]
    variants_map = get_product_variants_map(product_ids)

    result = []
    for p in products:
        variants = variants_map.get(p["id"], [])
        p["variants"] = variants
        p["available_sizes"] = [
            v["size"] for v in variants if v["availability"] == "IN_STOCK"
        ]
        result.append(p)

    return result


@app.get("/products/{product_id}")
def get_product(product_id: int):
    conn = get_conn()
    cur = conn.cursor()

    product = cur.execute(
        "SELECT * FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()

    variants = cur.execute(
        """
        SELECT external_variant_id, size, availability
        FROM variants
        WHERE product_id = ?
        ORDER BY size
        """,
        (product_id,),
    ).fetchall()

    conn.close()

    if not product:
        return {"error": "not found"}

    data = dict(product)
    data["variants"] = [dict(v) for v in variants]
    data["available_sizes"] = [
        v["size"] for v in data["variants"] if v["availability"] == "IN_STOCK"
    ]
    return data