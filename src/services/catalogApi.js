const CATALOG_API_BASE =
  import.meta.env.VITE_CATALOG_API_BASE || "http://localhost:8000";

export async function searchCatalog(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.append(key, value);
    }
  });

  const res = await fetch(
    `${CATALOG_API_BASE}/products/search_full?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Catalog API non raggiungibile");
  }

  return await res.json();
}