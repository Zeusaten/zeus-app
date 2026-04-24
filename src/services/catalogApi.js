const CATALOG_KEYS = {
  NEWFORM: "newform",
  DEMMA: "demma",
};

const CATALOG_CONFIGS = {
  [CATALOG_KEYS.NEWFORM]: {
    path: "/catalog/catalog.json",
    name: "New Form",
    productWord: "capo",
    stopwords: [
      "uomo", "uomini", "donna", "donne", "bambino", "bambini", "bambina", "bambine",
    ],
    categoryAliases: {
      Tshirt: [
        "tshirt", "t-shirt", "t shirt", "tee", "tee shirt", "maglietta", "magliette",
        "maglia manica corta", "maglie manica corta",
      ],
      Maglie: [
        "maglia", "maglie", "maglione", "maglioni", "pullover", "lupetto", "dolcevita",
        "cardigan", "sweater", "knitwear",
      ],
      Felpe: [
        "felpa", "felpe", "hoodie", "hoodies", "sweatshirt", "felpa cappuccio",
        "felpa con cappuccio", "felpa girocollo",
      ],
      Camicie: ["camicia", "camicie", "shirt", "shirts", "camicia elegante", "camicia casual"],
      Bluse: ["blusa", "bluse", "blouse", "blouses"],
      Polo: ["polo", "polo shirt", "polo manica corta", "polo manica lunga"],
      Top: ["top", "canotta", "canotte", "tank top", "crop top", "body", "bodysuit"],
      Pantaloni: [
        "pantalone", "pantaloni", "trousers", "pants", "cargo", "chino", "chinos",
        "jogger", "joggers", "pantaloni eleganti", "pantaloni casual",
      ],
      Jeans: ["jeans", "jean", "denim", "pantaloni jeans"],
      Shorts: ["short", "shorts", "bermuda", "bermudas", "pantaloncino", "pantaloncini"],
      Leggings: ["leggings", "legging", "fuseaux"],
      Gonne: ["gonna", "gonne", "skirt", "skirts", "minigonna", "minigonne"],
      Abiti: ["abito", "abiti", "vestito", "vestiti", "dress", "dresses", "tubino"],
      Tute: ["tuta", "tute", "tracksuit", "jumpsuit", "completo tuta"],
      Giacche: ["giacca", "giacche", "jacket", "jackets", "blazer", "giacca leggera"],
      Giubbotti: [
        "giubbotto", "giubbotti", "piumino", "piumini", "bomber", "parka", "cappotto",
        "cappotti", "coat", "coats", "outerwear", "giaccone", "kway", "k-way",
      ],
      Gilet: ["gilet", "smanicato", "smanicati", "vest", "panciotto"],
      Scarpe: [
        "scarpa", "scarpe", "sneaker", "sneakers", "tennis", "calzatura", "calzature",
        "stivale", "stivali", "mocassino", "mocassini", "sandalo", "sandali",
        "scarpe da ginnastica", "scarpe ginnastica",
      ],
      Ciabatte: ["ciabatta", "ciabatte", "slipper", "slippers", "infradito", "flip flop", "slides"],
      "Costumi mare": [
        "costume", "costumi", "costume mare", "costumi mare", "costume da bagno",
        "costumi da bagno", "boxer mare", "boxer da mare", "slip mare", "slip da mare",
        "swimwear", "bikini", "trikini",
      ],
      "Telo mare": ["telo mare", "telo da mare", "asciugamano mare", "beach towel"],
      "Teli mare": ["teli mare", "teli da mare", "asciugamani mare"],
      Intimo: [
        "intimo", "mutanda", "mutande", "boxer", "slip", "reggiseno", "reggiseni",
        "bralette", "underwear",
      ],
      Calze: ["calza", "calze", "calzino", "calzini", "socks", "sock"],
      Borse: [
        "borsa", "borse", "bag", "bags", "borsetta", "borsette", "tracolla", "tracolle",
        "shopping bag", "shopper", "pochette", "clutch", "marsupio", "marsupi",
      ],
      Zaini: ["zaino", "zaini", "backpack", "backpacks"],
      Portafogli: [
        "portafoglio", "portafogli", "wallet", "wallets", "portacarte", "porta carte", "card holder",
      ],
      Cinture: ["cintura", "cinture", "belt", "belts"],
      Cappelli: [
        "cappello", "cappelli", "berretto", "berretti", "cappellino", "cappellini", "cap",
        "caps", "hat", "hats", "beanie",
      ],
      Sciarpe: ["sciarpa", "sciarpe", "foulard", "stola", "scarf", "scarves"],
      Cravatte: ["cravatta", "cravatte", "tie", "ties"],
      Papillon: ["papillon", "bow tie", "farfallino"],
      Bracciali: ["bracciale", "bracciali", "bracelet", "bracelets"],
      Orologi: ["orologio", "orologi", "watch", "watches"],
      Portachiavi: ["portachiavi", "porta chiavi", "keychain", "key ring"],
      Accessori: ["accessorio", "accessori", "accessory", "accessories"],
    },
    audienceAliases: {
      Uomo: ["uomo", "uomini", "da uomo", "per uomo", "adulto uomo", "maschile", "maschio", "signore", "signori", "man", "men", "male"],
      Donna: ["donna", "donne", "da donna", "per donna", "adulta donna", "femminile", "femmina", "signora", "woman", "women", "female"],
      Bambino: ["bambino", "bambini", "bimbo", "bimbi", "da bambino", "per bambino", "maschietto", "neonato", "junior maschio", "ragazzino", "boy", "boys"],
      Bambina: ["bambina", "bambine", "bimba", "bimbe", "da bambina", "per bambina", "femminuccia", "neonata", "junior femmina", "ragazzina", "girl", "girls"],
    },
    extraLikelyTerms: [
      "abbigliamento", "capo", "capi", "vestiti", "moda", "outfit", "look", "taglia", "taglie",
      "dsquared", "tommy", "hilfiger", "calvin", "klein", "guess", "vans", "refrigue",
      "refrigiwear", "harmont", "blaine", "liu jo", "liu-jo", "sun68", "moschino", "diesel", "napapijri",
    ],
  },

  [CATALOG_KEYS.DEMMA]: {
    path: "/catalog/demma/catalog.json",
    name: "Sanitaria Demma",
    productWord: "prodotto",
    stopwords: [
      "demma", "sanitaria", "bimbo", "bimbi", "bambino", "bambini", "bambina", "bambine",
      "mamma", "casa", "adulto", "adulti",
    ],
    categoryAliases: {
      Pannolini: [
        "pannolino", "pannolini", "pannolini bimbo", "pannolini bambino", "pannolini bambina",
        "pampers", "huggies", "dry nites", "drynites", "swimpants", "little swimmer", "salvaletto",
      ],
      "Dietetica per bimbi": [
        "dietetica", "dietetica bimbi", "dietetica per bimbi", "alimenti infanzia", "cibi infanzia",
        "latte", "latte crescita", "latte in polvere", "latte liquido", "humana", "mellin", "hipp",
        "plasmon", "nipiol", "omogeneizzato", "omogeneizzati", "pastina", "pappa", "pappe", "merenda",
        "merendina", "frullato", "frutta", "pouch", "biscotti", "biscotto",
      ],
      "Detergenza per bimbi": [
        "detergenza bimbi", "detergenza per bimbi", "detergente bimbi", "detergente bambini",
        "salviette", "salviettine", "salviette baby", "bagnetto", "shampoo baby", "crema cambio",
        "pasta cambio", "camomilla baby", "baby wash",
      ],
      "Puericultura Leggera": [
        "puericultura leggera", "biberon", "ciuccio", "ciucci", "tettarella", "tettarelle",
        "massaggiagengive", "posate bimbo", "piattino", "bicchiere bimbo", "portaciuccio",
      ],
      "Puericultura Pesante": [
        "puericultura pesante", "passeggino", "passeggini", "seggiolino", "seggiolini", "seggiolone",
        "culla", "lettino", "box", "girello", "sdraietta", "trio", "carrozzina",
      ],
      Corredino: ["corredino", "copertina", "copertine", "body neonato", "tutina", "tutine", "bavaglino", "bavaglini", "lenzuolino", "lenzuolini"],
      Cosmetica: ["cosmetica", "crema", "creme", "shampoo", "bagnoschiuma", "sapone", "olio", "lozione", "deodorante", "igiene personale"],
      Farmaceutici: ["farmaceutico", "farmaceutici", "cerotti", "garze", "termometro", "disinfettante", "aerosol", "integratore", "integratori", "vitamine"],
      "Elettro Medicali": ["elettromedicali", "elettro medicali", "aerosol", "misuratore pressione", "pressione", "termometro", "bilancia", "saturimetro"],
      Giocattolo: ["giocattolo", "giocattoli", "gioco", "giochi", "peluche", "costruzioni", "bambola", "macchinina"],
      "Linea Premaman": ["premaman", "gravidanza", "maternita", "mamma", "allattamento", "assorbenti seno", "coppette seno", "fascia gravidanza"],
      "Linea Animali": ["animali", "cane", "cani", "gatto", "gatti", "sacchetti animali", "traversine", "crocchette", "lettiera", "talco animali"],
      Detersivi: ["detersivo", "detersivi", "bucato", "ammorbidente", "candeggina", "lavatrice", "piatti", "detergente casa"],
      Casalinghi: ["casalinghi", "casa", "cucina", "spugna", "spugne", "sacchetti", "pellicola", "alluminio", "contenitori"],
      Alimentari: ["alimentari", "cibo", "alimenti", "pasta", "riso", "biscotti", "snack", "barretta", "barrette", "bibite", "dolci", "dolciumi"],
      "Dolciumi e Bibite": ["dolciumi", "bibite", "caramelle", "candy", "lollipop", "bevanda", "bevande", "succhi"],
      Profumeria: ["profumeria", "profumo", "profumi", "make up", "trucco", "cosmesi", "alta profumeria", "profumeria alta", "profumeria bassa"],
      Cancelleria: ["cancelleria", "penna", "penne", "quaderno", "quaderni", "matita", "matite", "colori"],
      Elettricità: ["elettricita", "elettricità", "batterie", "pila", "pile", "lampadina", "lampadine"],
      Party: ["party", "festa", "feste", "carnevale", "stelle filanti", "coriandoli", "palloncini"],
      Accessori: ["accessori", "accessorio", "accessori uomo", "accessori donna", "accessori bambino"],
    },
    audienceAliases: {
      Bimbi: ["bimbo", "bimbi", "bambino", "bambini", "bambina", "bambine", "neonato", "neonati", "baby", "infanzia", "prima infanzia"],
      Mamma: ["mamma", "mamme", "premaman", "gravidanza", "maternita", "maternità", "allattamento"],
      Casa: ["casa", "casalinghi", "detersivi", "pulizia", "bucato"],
      Adulti: ["adulto", "adulti", "uomo", "donna", "profumeria", "farmaceutici", "elettromedicali"],
      Animali: ["animale", "animali", "cane", "gatto", "pet"],
    },
    extraLikelyTerms: [
      "sanitaria", "demma", "neonato", "neonati", "baby", "bimbi", "mamma", "pannolino",
      "pannolini", "latte", "humana", "mellin", "hipp", "plasmon", "omogeneizzati", "salviette",
      "biberon", "ciuccio", "puericultura", "premaman", "aerosol", "termometro", "pampers", "huggies",
    ],
  },
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
  rosa: ["rosa", "pink"],
  azzurro: ["azzurro", "azzurra", "celeste", "light blue"],
  marrone: ["marrone", "brown"],
};

const BASE_STOPWORDS = new Set([
  "fammi", "farmi", "vedere", "mostrami", "mostra", "cerco", "cerca", "voglio", "vorrei",
  "dammi", "trovami", "trova", "hai", "avete", "mi", "serve", "servono", "puoi", "potresti",
  "metti", "lista", "elenco", "articoli", "prodotti", "prodotto", "capi", "capo", "abbigliamento",
  "moda", "outfit", "di", "da", "del", "della", "dello", "dei", "delle", "degli", "per",
  "con", "in", "su", "che", "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "e", "o",
  "a", "al", "alla", "allo", "ai", "agli", "alle", "sotto", "sopra", "meno", "piu", "più", "max",
]);

const catalogCaches = {};

function getCatalogConfig(catalogKey = CATALOG_KEYS.NEWFORM) {
  return CATALOG_CONFIGS[catalogKey] || CATALOG_CONFIGS[CATALOG_KEYS.NEWFORM];
}

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

function getNgrams(tokens, maxSize = 4) {
  const out = [];

  for (let size = 1; size <= maxSize; size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      out.push(tokens.slice(i, i + size).join(" "));
    }
  }

  return out;
}

async function loadCatalogSnapshot(catalogKey = CATALOG_KEYS.NEWFORM) {
  const config = getCatalogConfig(catalogKey);

  if (catalogCaches[catalogKey]) return catalogCaches[catalogKey];

  const res = await fetch(config.path, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Snapshot catalogo ${config.name} non raggiungibile`);
  }

  const data = await res.json();
  const products = Array.isArray(data?.products) ? data.products : [];

  catalogCaches[catalogKey] = products.map((product) => ({
    ...product,
    catalog_key: catalogKey,
    catalog_name: config.name,
  }));

  return catalogCaches[catalogKey];
}

function getUniqueBrands(products) {
  return unique(
    products
      .map((p) => String(p.brand || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  );
}

function getAliasTerms(aliasMap) {
  return Object.entries(aliasMap).flatMap(([canonical, aliases]) => [
    canonical,
    ...aliases,
  ]);
}

function resolveAlias(rawQuery, aliasMap, explicitValue = null) {
  const query = normalizeText(rawQuery);
  const grams = getNgrams(tokenize(rawQuery), 4);

  if (explicitValue) {
    let explicitBest = null;
    let explicitScore = 0;

    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      const variants = [canonical, ...aliases];

      for (const variant of variants) {
        if (fuzzyEquals(explicitValue, variant)) {
          const score = normalizeText(variant).length + 100;
          if (score > explicitScore) {
            explicitBest = canonical;
            explicitScore = score;
          }
        }
      }
    }

    if (explicitBest) return explicitBest;
  }

  let best = null;
  let bestScore = 0;

  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    const variants = [canonical, ...aliases];

    for (const variant of variants) {
      const normalizedVariant = normalizeText(variant);
      if (!normalizedVariant) continue;

      let score = 0;

      if (query.includes(normalizedVariant)) {
        score = normalizedVariant.length + 50;
      }

      if (grams.some((gram) => fuzzyEquals(gram, variant))) {
        score = Math.max(score, normalizedVariant.length + 20);
      }

      if (score > bestScore) {
        best = canonical;
        bestScore = score;
      }
    }
  }

  return best || explicitValue || null;
}

function resolveCategory(rawQuery, products, config, explicitCategory = null) {
  const aliasCategory = resolveAlias(rawQuery, config.categoryAliases, explicitCategory);
  if (aliasCategory) return aliasCategory;

  const categories = unique(
    products
      .map((p) => String(p.category || "").trim())
      .filter(Boolean)
  );
  const query = normalizeText(rawQuery);
  const grams = getNgrams(tokenize(rawQuery), 4);

  let best = null;
  let bestScore = 0;

  for (const category of categories) {
    const normalizedCategory = normalizeText(category);

    let score = 0;
    if (query.includes(normalizedCategory)) {
      score = normalizedCategory.length + 40;
    }
    if (grams.some((gram) => fuzzyEquals(gram, category))) {
      score = Math.max(score, normalizedCategory.length + 15);
    }

    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best;
}

function resolveAudience(rawQuery, config, explicitAudience = null) {
  return resolveAlias(rawQuery, config.audienceAliases, explicitAudience);
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

    if (brandCompact && queryCompact.includes(brandCompact)) {
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
    { regex: /\bTG\.?\s*([0-9]+)\b/i, value: null },
    { regex: /\bTAGLIA\s*([0-9]+)\b/i, value: null },
  ];

  for (const item of patterns) {
    const match = text.match(item.regex);
    if (match) return item.value || match[1];
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
    text.includes("magazzino") ||
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
    `${product.name || ""} ${product.color_code || ""} ${product.description || ""}`
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
  const productAvailability = String(product.availability || "").toUpperCase();
  const quantity = Number(product.available_quantity ?? product.quantity ?? NaN);

  if (!size && !availability) return true;

  if (size && variants.length === 0) {
    const haystack = normalizeText(`${product.name || ""} ${product.description || ""}`);
    if (!haystack.includes(normalizeText(size))) return false;
  }

  if (availability && variants.length === 0) {
    if (productAvailability === String(availability).toUpperCase()) return true;
    if (availability === "IN_STOCK" && Number.isFinite(quantity) && quantity > 0) return true;
    return false;
  }

  if (variants.length === 0) return true;

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


function getCategoryAliasTerms(config, category) {
  if (!category || !config?.categoryAliases) return [];

  const aliases = config.categoryAliases[category] || [];
  return [category, ...aliases].filter(Boolean);
}

function productMatchesCategory(product, category, config, rawQuery = "") {
  if (!category) return true;

  const haystack = normalizeText(
    `${product.name || ""} ${product.brand || ""} ${product.category || ""} ${product.description || ""}`
  );

  const productCategory = normalizeText(product.category);
  const wantedCategory = normalizeText(category);

  if (productCategory && productCategory === wantedCategory) return true;
  if (wantedCategory && haystack.includes(wantedCategory)) return true;

  const aliasTerms = getCategoryAliasTerms(config, category);

  for (const term of aliasTerms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm || normalizedTerm.length < 3) continue;

    if (haystack.includes(normalizedTerm)) return true;
  }

  const queryTokens = tokenize(rawQuery).filter(
    (token) => token.length >= 3 && !BASE_STOPWORDS.has(token)
  );

  return queryTokens.some((token) => haystack.includes(token));
}

function productMatchesAudience(product, audience) {
  if (!audience) return true;

  const haystack = normalizeText(
    `${product.gender || ""} ${product.audience || ""} ${product.category || ""} ${product.name || ""}`
  );

  return haystack.includes(normalizeText(audience));
}

function scoreProduct(product, context) {
  let score = 0;

  const haystack = normalizeText(
    `${product.name || ""} ${product.brand || ""} ${product.category || ""} ${product.gender || ""} ${product.audience || ""} ${product.color_code || ""} ${product.description || ""}`
  );
  const haystackTokens = tokenize(haystack);

  if (context.brand) {
    if (normalizeText(product.brand) === normalizeText(context.brand)) score += 40;
    else if (fuzzyEquals(product.brand, context.brand)) score += 24;
  }

  if (context.category) {
    if (normalizeText(product.category) === normalizeText(context.category)) {
      score += 24;
    } else if (haystack.includes(normalizeText(context.category))) {
      score += 12;
    } else if (productMatchesCategory(product, context.category, context.config, context.rawQuery)) {
      score += 10;
    }
  }

  if (context.audience && productMatchesAudience(product, context.audience)) {
    score += 14;
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

export function isLikelyCatalogQuery(text, catalogKey = CATALOG_KEYS.NEWFORM) {
  const config = getCatalogConfig(catalogKey);
  const query = normalizeText(text);
  const tokens = tokenize(text);
  const grams = getNgrams(tokens, 4);

  const shoppingTerms = [
    "catalogo", "catalog", "negozio", "shop", "shopping", "taglia", "taglie", "misura", "misure",
    "disponibile", "disponibili", "in stock", "magazzino", "prezzo", "euro", "sconto", "scontato",
    "marca", "brand", config.name, ...config.extraLikelyTerms,
    ...getAliasTerms(config.categoryAliases),
    ...getAliasTerms(config.audienceAliases),
    ...getAliasTerms(COLOR_ALIASES),
  ];

  if (shoppingTerms.some((term) => query.includes(normalizeText(term)))) {
    return true;
  }

  const fuzzyTerms = shoppingTerms.filter((term) => normalizeText(term).length >= 4);

  return grams.some((gram) =>
    fuzzyTerms.some((term) => fuzzyEquals(gram, term))
  );
}

export async function searchCatalog(filters = {}, options = {}) {
  const catalogKey = filters.catalogKey || options.catalogKey || CATALOG_KEYS.NEWFORM;
  const config = getCatalogConfig(catalogKey);
  const products = await loadCatalogSnapshot(catalogKey);
  const rawQuery = String(filters.raw_query || filters.q || "").trim();

  const brand = resolveBrand(rawQuery, products, filters.brand);
  const category = resolveCategory(rawQuery, products, config, filters.category);
  const audience = resolveAudience(rawQuery, config, filters.gender || filters.audience);
  const color = resolveAlias(rawQuery, COLOR_ALIASES, filters.color);
  const size = resolveSize(rawQuery, filters.size);
  const availability = resolveAvailability(rawQuery, filters.availability);
  const { minPrice, maxPrice } = resolvePrices(
    rawQuery,
    filters.min_price,
    filters.max_price
  );

  const stopwords = new Set([
    ...BASE_STOPWORDS,
    ...(config.stopwords || []),
  ]);

  const queryTokens = tokenize(rawQuery).filter(
    (token) => !stopwords.has(token) && token.length > 1
  );

  const context = {
    rawQuery,
    brand,
    category,
    audience,
    color,
    size,
    availability,
    minPrice,
    maxPrice,
    queryTokens,
    config,
  };

  let results = products.filter((product) => {
    if (brand && !fuzzyEquals(product.brand, brand)) return false;

    if (category && !productMatchesCategory(product, category, config, rawQuery)) {
      return false;
    }

    if (audience && !productMatchesAudience(product, audience)) return false;
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
        brand ||
        category ||
        audience ||
        color ||
        size ||
        availability ||
        minPrice != null ||
        maxPrice != null;

      if (hasHardFilter) return true;

      return product._score > 0;
    })
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .map(({ _score, ...product }) => product);

  if (results.length === 0 && rawQuery) {
    const fallbackTokens = queryTokens.filter((token) => token.length >= 3);

    if (fallbackTokens.length > 0) {
      results = products
        .map((product) => {
          const haystack = normalizeText(
            `${product.name || ""} ${product.brand || ""} ${product.category || ""} ${product.description || ""}`
          );

          const matchedTokens = fallbackTokens.filter((token) => haystack.includes(token));

          return {
            ...product,
            _score: matchedTokens.reduce((sum, token) => sum + token.length, 0),
          };
        })
        .filter((product) => product._score > 0)
        .sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          return String(a.name || "").localeCompare(String(b.name || ""));
        })
        .map(({ _score, ...product }) => product);
    }
  }

  return results;
}

export function clearCatalogCache(catalogKey = null) {
  if (catalogKey) {
    catalogCaches[catalogKey] = null;
    return;
  }

  Object.keys(catalogCaches).forEach((key) => {
    catalogCaches[key] = null;
  });
}
