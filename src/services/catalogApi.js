let catalogCache = null;

async function loadCatalogSnapshot() {
  if (catalogCache) return catalogCache;

  const res = await fetch("/catalog/catalog.json", { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Snapshot catalogo non raggiungibile");
  }

  const data = await res.json();
  catalogCache = Array.isArray(data?.products) ? data.products : [];
  return catalogCache;
}

function includesCI(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

export async function searchCatalog(filters = {}) {
  const products = await loadCatalogSnapshot();

  return products.filter((product) => {
    if (filters.brand && String(product.brand).toLowerCase() !== String(filters.brand).toLowerCase()) {
      return false;
    }

    if (filters.category && String(product.category).toLowerCase() !== String(filters.category).toLowerCase()) {
      return false;
    }

    if (filters.gender && String(product.gender).toLowerCase() !== String(filters.gender).toLowerCase()) {
      return false;
    }

    if (filters.color && !includesCI(product.name, filters.color)) {
      return false;
    }

    if (filters.min_price != null && Number(product.price) < Number(filters.min_price)) {
      return false;
    }

    if (filters.max_price != null && Number(product.price) > Number(filters.max_price)) {
      return false;
    }

    if (filters.q && !includesCI(product.name, filters.q)) {
      return false;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];

    if (filters.size) {
      const hasSize = variants.some(
        (v) => String(v.size).toLowerCase() === String(filters.size).toLowerCase()
      );
      if (!hasSize) return false;
    }

    if (filters.availability) {
      if (filters.size) {
        const hasAvailableSize = variants.some(
          (v) =>
            String(v.size).toLowerCase() === String(filters.size).toLowerCase() &&
            String(v.availability).toLowerCase() === String(filters.availability).toLowerCase()
        );
        if (!hasAvailableSize) return false;
      } else {
        const hasAvailableVariant = variants.some(
          (v) =>
            String(v.availability).toLowerCase() === String(filters.availability).toLowerCase()
        );
        if (!hasAvailableVariant) return false;
      }
    }

    return true;
  });
}

export function clearCatalogCache() {
  catalogCache = null;
}