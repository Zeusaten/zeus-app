let catalogCache = null;

const STOPWORDS = new Set([
  "fammi",
  "farmi",
  "vedere",
  "mostrami",
  "mostra",
  "cerco",
  "cerca",
  "voglio",
  "vorrei",
  "dammi",
  "trovami",
  "trova",
  "hai",
  "avete",
  "di",
  "da",
  "del",
  "della",
  "dello",
  "dei",
  "delle",
  "degli",
  "per",
  "con",
  "in",
  "su",
  "che",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "uomo",
  "donna",
  "bambino",
  "bambina",
]);

const CATEGORY_ALIASES = {
  Tshirt: ["tshirt", "t-shirt", "t shirt", "maglietta", "magliette", "tee"],
  Pantaloni: ["pantalone", "pantaloni", "trousers", "cargo"],
  Felpa: ["felpa", "felpe", "hoodie", "sweatshirt"],
  Scarpe: ["scarpa", "scarpe", "sneaker", "sneakers"],
  Polo: ["polo"],
  Camicia: ["camicia", "camicie", "shirt"],
  Giacca: ["giacca", "giacche", "jacket"],
  Jeans: ["jeans", "denim"],
  Costume: ["costume", "costumi", "swimwear", "boxer mare", "slip mare"],
};

const GENDER_ALIASES = {
  Uomo: ["uomo", "uomini", "man", "men", "maschio"],
  Donna: ["donna", "donne", "woman", "women", "femmina"],
  Bambino: ["bambino", "bambini", "boy", "boys"],
  Bambina: ["bambina", "bambine", "girl", "girls"],
};

const COLOR_ALIASES = {
  nero: ["nero", "nera", "neri", "nere", "black"],
  bianco: ["bianco", "bianca", "bianchi", "bianche", "white"],
  blu: ["blu", "blue", "navy"],
  verde: ["verde", "green"],
  rosso: ["rosso", "rossa", "rossi", "rosse", "red"],
  grigio: ["grigio", "grigia", "grigi", "grigie", "grey", "gray"],
  giallo: ["giallo", "gialla", "yellow"],
  beige: ["beige", "sabbia", "sand"],
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr)];
}

function levenshtein(a, b) {
  const aa = compactText(a);
  const bb = compactText(b);

  if (aa === bb) return 0;
  if (!aa.length) return bb.length;
  if (!bb.length) return aa.length;

  const matrix = Array.from({ length: aa.length + 1 }, () =>
    Array(bb.length + 1).fill(0)
  );

  for (let i = 0; i <= aa.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bb.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= aa.length; i += 1) {
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aa.length][bb.length];
}

function fuzzyEquals(a, b) {
  const aa = compactText(a);
  const bb = compactText(b);

  if (!aa || !bb) return false;
  if (aa === bb) return true;
  if (aa.includes(bb) || bb.includes(aa)) return true;

  const distance = levenshtein(aa, bb);
  const minLen = Math.min(aa.length, bb.length);
  const threshold = minLen <= 4 ? 1 : Math.max(1, Math.floor(minLen * 0.25));

  return distance <= threshold;
}

function getNgrams(tokens, maxSize = 3) {
  const out = [];

  for (let size = 1; size <= maxSize; size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      out.push(tokens.slice(i, i + size).join(" "));
    }
  }

  return out;
}

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

function getUniqueBrands(products) {
  return unique(
    products
      .map((p) => String(p.brand || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  );
}

function resolveAlias(rawQuery, aliasMap, explicitValue = null) {
  const query = normalizeText(rawQuery);
  const grams = getNgrams(tokenize(rawQuery), 3);

  if (explicitValue) {
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      if (fuzzyEquals(explicitValue, canonical)) return canonical;
      if (aliases.some((alias) => fuzzyEquals(explicitValue, alias))) {
        return canonical;
      }
    }
  }

  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    const variants = [canonical, ...aliases];

    for (const variant of variants) {
      const normalizedVariant = normalizeText(variant);

      if (query.includes(normalizedVariant)) {
        return canonical;
      }

      if (grams.some((gram) => fuzzyEquals(gram, variant))) {
        return canonical;
      }
    }
  }

  return explicitValue || null;
}

function resolveBrand(rawQuery, products, explicitBrand = null) {
  const brands = getUniqueBrands(products);
  const grams = getNgrams(tokenize(rawQuery), 3);
  const queryCompact = compactText(rawQuery);

  if (explicitBrand) {
    const exact = brands.find((brand) => fuzzyEquals(brand, explicitBrand));
    if (exact) return exact;
  }

  for (const brand of brands) {
    const brandCompact = compactText(brand);

    if (queryCompact.includes(brandCompact)) {
      return brand;
    }
  }

  let best = null;
  let bestDistance = Infinity;

  for (const brand of brands) {
    for (const gram of grams) {
      const distance = levenshtein(brand, gram);
      const minLen = Math.min(compactText(brand).length, compactText(gram).length);
      const threshold = minLen <= 4 ? 1 : Math.max(1, Math.floor(minLen * 0.25));

      if (distance <= threshold && distance < bestDistance) {
        best = brand;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function resolveSize(rawQuery, explicitSize = null) {
  if (explicitSize) return String(explicitSize).toUpperCase();

  const text = rawQuery.toUpperCase();

  const patterns = [
    { regex: /\bXXL\b/, value: "XXL" },
    { regex: /\bXL\b/, value: "XL" },
    { regex: /\bXS\b/, value: "XS" },
    { regex: /\bM\b/, value: "M" },
    { regex: /\bL\b/, value: "L" },
    { regex: /\bS\b/, value: "S" },
  ];

  for (const item of patterns) {
    if (item.regex.test(text)) return item.value;
  }

  return null;
}

function resolveAvailability(rawQuery, explicitAvailability = null) {
  if (explicitAvailability) return explicitAvailability;

  const text = normalizeText(rawQuery);
  if (
    text.includes("disponibile") ||
    text.includes("disponibili") ||
    text.includes("in stock") ||
    text.includes("pronta consegna")
  ) {
    return "IN_STOCK";
  }

  return null;
}

function resolvePrices(rawQuery, explicitMin = null, explicitMax = null) {
  let minPrice = explicitMin != null ? Number(explicitMin) : null;
  let maxPrice = explicitMax != null ? Number(explicitMax) : null;

  const text = normalizeText(rawQuery);

  const maxMatch =
    text.match(/sotto\s+([0-9]+(?:[.,][0-9]+)?)/i) ||
    text.match(/meno di\s+([0-9]+(?:[.,][0-9]+)?)/i) ||
    text.match(/max\s+([0-9]+(?:[.,][0-9]+)?)/i);

  if (maxMatch && maxPrice == null) {
    maxPrice = Number(maxMatch[1].replace(",", "."));
  }

  const minMatch =
    text.match(/sopra\s+([0-9]+(?:[.,][0-9]+)?)/i) ||
    text.match(/piu di\s+([0-9]+(?:[.,][0-9]+)?)/i) ||
    text.match(/piu\s+di\s+([0-9]+(?:[.,][0-9]+)?)/i);

  if (minMatch && minPrice == null) {
    minPrice = Number(minMatch[1].replace(",", "."));
  }

  return { minPrice, maxPrice };
}

function getColorVariants(color) {
  if (!color) return [];
  return COLOR_ALIASES[color] || [color];
}

function productMatchesColor(product, color) {
  if (!color) return true;

  const haystack = normalizeText(
    `${product.name || ""} ${product.color_code || ""}`
  );

  return getColorVariants(color).some((variant) =>
    haystack.includes(normalizeText(variant))
  );
}

function getVariants(product) {
  return Array.isArray(product.variants) ? product.variants : [];
}

function productMatchesSizeAndAvailability(product, size, availability) {
  const variants = getVariants(product);

  if (!size && !availability) return true;
  if (variants.length === 0) return false;

  return variants.some((variant) => {
    const sizeOk = size
      ? String(variant.size || "").toUpperCase() === String(size).toUpperCase()
      : true;

    const availabilityOk = availability
      ? String(variant.availability || "").toUpperCase() ===
        String(availability).toUpperCase()
      : true;

    return sizeOk && availabilityOk;
  });
}

function fuzzyTokenMatch(token, textTokens) {
  return textTokens.some((candidate) => fuzzyEquals(token, candidate));
}

function scoreProduct(product, context) {
  let score = 0;

  const haystack = normalizeText(
    `${product.name || ""} ${product.brand || ""} ${product.category || ""} ${
      product.gender || ""
    } ${product.color_code || ""}`
  );
  const haystackTokens = tokenize(haystack);

  if (context.brand) {
    if (normalizeText(product.brand) === normalizeText(context.brand)) score += 40;
    else if (fuzzyEquals(product.brand, context.brand)) score += 24;
  }

  if (context.category) {
    if (normalizeText(product.category) === normalizeText(context.category)) {
      score += 24;
    }
  }

  if (context.gender) {
    if (normalizeText(product.gender) === normalizeText(context.gender)) {
      score += 14;
    }
  }

  if (context.color && productMatchesColor(product, context.color)) {
    score += 10;
  }

  if (context.size && productMatchesSizeAndAvailability(product, context.size, null)) {
    score += 14;
  }

  if (
    context.availability &&
    productMatchesSizeAndAvailability(product, context.size, context.availability)
  ) {
    score += 10;
  }

  for (const token of context.queryTokens) {
    if (!token || token.length < 2) continue;

    if (haystack.includes(token)) {
      score += token.length >= 5 ? 5 : 3;
    } else if (fuzzyTokenMatch(token, haystackTokens)) {
      score += 2;
    }
  }

  if (product.old_price && product.price && Number(product.old_price) > Number(product.price)) {
    score += 1;
  }

  return score;
}

export function isLikelyCatalogQuery(text) {
  const query = normalizeText(text);
  const tokens = tokenize(text);
  const grams = getNgrams(tokens, 3);

  const shoppingTerms = [
    "new form",
    "catalogo",
    "catalog",
    "maglietta",
    "magliette",
    "tshirt",
    "t shirt",
    "t-shirt",
    "pantalone",
    "pantaloni",
    "felpa",
    "felpe",
    "scarpa",
    "scarpe",
    "sneaker",
    "sneakers",
    "camicia",
    "camicie",
    "giacca",
    "giacche",
    "jeans",
    "polo",
    "costume",
    "costumi",
    "taglia",
    "disponibile",
    "disponibili",
    "prezzo",
    "euro",
    "marca",
    "brand",
    "nero",
    "nera",
    "bianco",
    "bianca",
    "blu",
    "verde",
    "rosso",
    "rossa",
    "grigio",
    "grigia",
    "uomo",
    "donna",
    "bambino",
    "bambina",
    "dsquared",
    "tommy",
    "hilfiger",
    "calvin",
    "klein",
    "guess",
    "vans",
    "refrigue",
    "harmont",
    "blaine",
  ];

  if (shoppingTerms.some((term) => query.includes(normalizeText(term)))) {
    return true;
  }

  const fuzzyBrands = [
    "dsquared",
    "tommy hilfiger",
    "calvin klein",
    "north sails",
    "guess",
    "vans",
    "refrigue",
    "harmont blaine",
  ];

  return grams.some((gram) =>
    fuzzyBrands.some((brand) => fuzzyEquals(gram, brand))
  );
}

export async function searchCatalog(filters = {}) {
  const products = await loadCatalogSnapshot();
  const rawQuery = String(filters.raw_query || filters.q || "").trim();

  const brand = resolveBrand(rawQuery, products, filters.brand);
  const category = resolveAlias(rawQuery, CATEGORY_ALIASES, filters.category);
  const gender = resolveAlias(rawQuery, GENDER_ALIASES, filters.gender);
  const color = resolveAlias(rawQuery, COLOR_ALIASES, filters.color);
  const size = resolveSize(rawQuery, filters.size);
  const availability = resolveAvailability(rawQuery, filters.availability);
  const { minPrice, maxPrice } = resolvePrices(
    rawQuery,
    filters.min_price,
    filters.max_price
  );

  const queryTokens = tokenize(rawQuery).filter(
    (token) => !STOPWORDS.has(token) && token.length > 1
  );

  const context = {
    rawQuery,
    brand,
    category,
    gender,
    color,
    size,
    availability,
    minPrice,
    maxPrice,
    queryTokens,
  };

  let results = products.filter((product) => {
    if (brand && !fuzzyEquals(product.brand, brand)) return false;
    if (category && normalizeText(product.category) !== normalizeText(category)) return false;
    if (gender && normalizeText(product.gender) !== normalizeText(gender)) return false;
    if (color && !productMatchesColor(product, color)) return false;

    if (minPrice != null && Number(product.price) < Number(minPrice)) return false;
    if (maxPrice != null && Number(product.price) > Number(maxPrice)) return false;

    if (!productMatchesSizeAndAvailability(product, size, availability)) return false;

    return true;
  });

  results = results
    .map((product) => ({
      ...product,
      _score: scoreProduct(product, context),
    }))
    .filter((product) => {
      if (!rawQuery) return true;

      const hasHardFilter =
        brand || category || gender || color || size || availability || minPrice != null || maxPrice != null;

      if (hasHardFilter) return true;

      return product._score > 0;
    })
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .map(({ _score, ...product }) => product);

  return results;
}

export function clearCatalogCache() {
  catalogCache = null;
}