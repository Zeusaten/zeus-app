import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./styles.css";
import { getCatalogAiReply, getZeusAiReply, loadZeusEngine } from "./services/zeusAiReply";
import {
  DEFAULT_PROFILE,
  applyProfileUpdates,
  extractProfileUpdates,
  getDeterministicReply,
} from "./services/zeusCore";
import {
  createCanvaDesign,
  createCanvaExport,
  getCanvaStatus,
  pollCanvaExport,
  startCanvaConnect,
} from "./services/canvaApi";
import {
  searchCatalog,
  isLikelyCatalogQuery,
} from "./services/catalogApi";

const STORAGE_CONVERSATIONS = "zeus_conversations";
const STORAGE_ACTIVE_CONVERSATION = "zeus_active_conversation";
const STORAGE_PROFILE = "zeus_profile";
const STORAGE_CANVA_LAST_DESIGN = "zeus_canva_last_design";
const STORAGE_APP_MODE = "zeus_app_mode";

const APP_MODES = {
  ZEUS: "zeus",
  NEWFORM: "newform",
  DEMMA: "demma",
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeMessage(mode = APP_MODES.ZEUS) {
  const isNewForm = mode === APP_MODES.NEWFORM;
  const isDemma = mode === APP_MODES.DEMMA;

  return {
    sender: "zeus",
    text: isDemma
      ? "Ciao, sono Ted. Ti aiuto esclusivamente con il catalogo Demma. Puoi chiedermi pannolini, prodotti baby, puericultura, alimentari, cosmetica, casa e molto altro."
      : isNewForm
        ? "Ciao, sono Pino. Ti aiuto esclusivamente con il catalogo New Form. Puoi chiedermi prodotti per uomo, donna, bambino e bambina."
        : "Ciao. Sono Zeus. Ti aiuto in italiano con idee, organizzazione, scrittura e ricerche online con fonti.",
    grounded: false,
    searchQueries: [],
    sources: [],
    products: [],
  };
}

function createConversation(title = "Nuova chat", mode = APP_MODES.ZEUS) {
  const now = Date.now();

  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    mode,
    messages: [createWelcomeMessage(mode)],
  };
}

function getConversationTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (!clean) return "Nuova chat";
  if (clean.length <= 38) return clean;

  return `${clean.slice(0, 38).trim()}...`;
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") return null;

  return {
    sender: message.sender === "user" ? "user" : "zeus",
    text: typeof message.text === "string" ? message.text : "",
    grounded: Boolean(message.grounded),
    searchQueries: Array.isArray(message.searchQueries)
      ? message.searchQueries
      : [],
    sources: Array.isArray(message.sources) ? message.sources : [],
    products: Array.isArray(message.products) ? message.products : [],
  };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== "object") return null;

  const normalizedMessages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter(Boolean)
    : [];

  const mode =
    raw.mode === APP_MODES.DEMMA
      ? APP_MODES.DEMMA
      : raw.mode === APP_MODES.NEWFORM
        ? APP_MODES.NEWFORM
        : APP_MODES.ZEUS;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : "Nuova chat",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    mode,
    messages:
      normalizedMessages.length > 0
        ? normalizedMessages
        : [createWelcomeMessage(mode)],
  };
}

function normalizeAssistantPayload(payload) {
  if (typeof payload === "string") {
    return {
      text: payload,
      grounded: false,
      searchQueries: [],
      sources: [],
      products: [],
    };
  }

  return {
    text: payload?.reply || "Non sono riuscito a generare una risposta valida.",
    grounded: Boolean(payload?.grounded),
    searchQueries: Array.isArray(payload?.searchQueries)
      ? payload.searchQueries
      : [],
    sources: Array.isArray(payload?.sources) ? payload.sources : [],
    products: Array.isArray(payload?.products) ? payload.products : [],
  };
}

function MarkdownMessage({ text }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noreferrer" />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function ProductShoppingCard({ product }) {
  const hasSizes =
    Array.isArray(product.available_sizes) && product.available_sizes.length > 0;

  const sizes = hasSizes
    ? product.available_sizes.join(", ")
    : null;

  const quantity = Number(product.available_quantity ?? product.quantity ?? NaN);
  const normalizedAvailability = String(product.availability || "").toLowerCase();
  const isInStock =
    normalizedAvailability === "in_stock" ||
    normalizedAvailability.includes("instock");
  const isOutOfStock =
    normalizedAvailability === "out_of_stock" ||
    normalizedAvailability.includes("outofstock");
  const availabilityText =
    hasSizes
      ? `Taglie: ${sizes}`
      : Number.isFinite(quantity)
        ? `Disponibilità: ${quantity > 0 ? `${quantity} in stock` : "Non disponibile"}`
        : isInStock
          ? "Disponibile"
          : isOutOfStock
            ? "Non disponibile"
            : "Disponibilità da verificare";

  const currentPrice =
    product.price != null ? `€${Number(product.price).toFixed(2)}` : null;

  const oldPrice =
    product.old_price != null
      ? `€${Number(product.old_price).toFixed(2)}`
      : null;

  return (
    <a
      href={product.url}
      target="_blank"
      rel="noreferrer"
      className="shopping-card"
    >
      <div className="shopping-card-image-wrap">
        {product.main_image ? (
          <img
            src={product.main_image}
            alt={product.name}
            className="shopping-card-image"
            loading="lazy"
          />
        ) : (
          <div className="shopping-card-image-placeholder">
            Nessuna immagine
          </div>
        )}
      </div>

      <div className="shopping-card-body">
        <div className="shopping-card-brand">{product.brand || "Brand"}</div>
        <div className="shopping-card-name">{product.name}</div>

        <div className="shopping-card-prices">
          {currentPrice && (
            <span className="shopping-card-price">{currentPrice}</span>
          )}
          {oldPrice && (
            <span className="shopping-card-old-price">{oldPrice}</span>
          )}
        </div>

        <div className="shopping-card-sizes">{availabilityText}</div>

        <div className="shopping-card-link">Apri prodotto</div>
      </div>
    </a>
  );
}

function ProductShoppingRail({ products }) {
  const railRef = useRef(null);
  const INITIAL_VISIBLE = 8;
  const STEP = 8;

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const visibleProducts = products.slice(0, visibleCount);
  const hasMoreProducts = visibleCount < products.length;

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [products]);

  const updateScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(id);
  }, [visibleProducts.length, updateScrollState]);

  function scrollRail(direction) {
    const el = railRef.current;
    if (!el) return;

    el.scrollBy({
      left: direction * 340,
      behavior: "smooth",
    });

    setTimeout(updateScrollState, 250);
  }

  function loadMoreProducts() {
    setVisibleCount((prev) => Math.min(prev + STEP, products.length));

    setTimeout(() => {
      updateScrollState();
    }, 50);
  }

  function handleRightAction() {
    if (canScrollRight) {
      scrollRail(1);
      return;
    }

    if (hasMoreProducts) {
      loadMoreProducts();

      setTimeout(() => {
        scrollRail(1);
      }, 80);
    }
  }

  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div className="shopping-rail-shell">
      <div className="shopping-rail-header">
        <div className="shopping-rail-summary">
          {visibleProducts.length} di {products.length} prodotti visibili
        </div>

        <div className="shopping-rail-controls">
          <button
            type="button"
            className="shopping-rail-arrow"
            onClick={() => scrollRail(-1)}
            disabled={!canScrollLeft}
            aria-label="Scorri a sinistra"
          >
            ‹
          </button>

          <button
            type="button"
            className="shopping-rail-arrow"
            onClick={handleRightAction}
            disabled={!canScrollRight && !hasMoreProducts}
            aria-label="Scorri a destra o carica altri prodotti"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="shopping-rail"
        role="list"
        aria-label="Prodotti trovati"
        onScroll={updateScrollState}
      >
        {visibleProducts.map((product) => (
          <ProductShoppingCard
            key={`${product.id}-${product.url}`}
            product={product}
          />
        ))}
      </div>

      {hasMoreProducts && (
        <button
          type="button"
          className="shopping-show-more"
          onClick={loadMoreProducts}
        >
          Carica altri {Math.min(STEP, products.length - visibleCount)} prodotti
        </button>
      )}
    </div>
  );
}

function ProductCatalogGrid({ products, visibleCount, onLoadMore }) {
  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="catalog-empty-state">
        <div className="catalog-empty-icon">🔎</div>
        <h3>Nessun prodotto trovato</h3>
        <p>Prova a cambiare categoria o a scrivere una ricerca più semplice.</p>
      </div>
    );
  }

  const visibleProducts = products.slice(0, visibleCount);
  const remainingCount = Math.max(products.length - visibleProducts.length, 0);

  return (
    <>
      <div className="catalog-grid" role="list" aria-label="Prodotti New Form">
        {visibleProducts.map((product) => (
          <ProductShoppingCard
            key={`${product.id}-${product.url}`}
            product={product}
          />
        ))}
      </div>

      {remainingCount > 0 && (
        <div className="catalog-load-more-wrap">
          <button
            type="button"
            className="catalog-load-more"
            onClick={onLoadMore}
          >
            Carica altri {Math.min(24, remainingCount)} prodotti
          </button>
        </div>
      )}
    </>
  );
}

function BrandLogo({ mode }) {
  if (mode === APP_MODES.DEMMA) {
    return (
      <div className="brand-image-logo demma-brand-logo">
        <img src="/demma-logo.png" alt="Demma logo" />
      </div>
    );
  }

  if (mode === APP_MODES.NEWFORM) {
    return (
      <div className="brand-image-logo">
        <img src="/newform-logo.png" alt="New Form logo" />
      </div>
    );
  }

  return (
    <div className="zeus-logo">
      <div className="zeus-logo-core">Z</div>
    </div>
  );
}

function AssistantAvatar({ mode }) {
  if (mode === APP_MODES.DEMMA) {
    return (
      <div className="assistant-avatar assistant-avatar-image demma-assistant-avatar">
        <img src="/demma-chat-logo.png" alt="Ted Demma" />
      </div>
    );
  }

  if (mode === APP_MODES.NEWFORM) {
    return (
      <div className="assistant-avatar assistant-avatar-image">
        <img src="/newform-logo.png" alt="Pino New Form" />
      </div>
    );
  }

  return <div className="assistant-avatar">Z</div>;
}

function getStatusLabel(statusText, isLoading, assistantName = "Zeus") {
  const lower = statusText.toLowerCase();

  if (isLoading) return `${assistantName} sta scrivendo...`;
  if (lower.includes("pronto")) return `${assistantName} è pronto`;

  if (
    lower.includes("riattivando") ||
    lower.includes("risvegliando") ||
    lower.includes("collegando") ||
    lower.includes("lento")
  ) {
    return `${assistantName} si sta risvegliando...`;
  }

  if (lower.includes("connessione")) return `Connessione a ${assistantName} non riuscita`;

  return statusText;
}

function convertToPx(value, unit) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  if (unit === "px") {
    return Math.round(numeric);
  }

  if (unit === "mm") {
    return Math.round((numeric / 25.4) * 96);
  }

  if (unit === "cm") {
    return Math.round((numeric / 2.54) * 96);
  }

  return Math.round(numeric);
}

function parsePagesInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return undefined;

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const pages = new Set();

  for (const part of parts) {
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-").map((v) => Number(v.trim()));
      if (
        Number.isInteger(startRaw) &&
        Number.isInteger(endRaw) &&
        startRaw > 0 &&
        endRaw >= startRaw
      ) {
        for (let i = startRaw; i <= endRaw; i += 1) {
          pages.add(i);
        }
      }
    } else {
      const page = Number(part);
      if (Number.isInteger(page) && page > 0) {
        pages.add(page);
      }
    }
  }

  return pages.size ? Array.from(pages) : undefined;
}

function openUrls(urls = []) {
  const clean = urls.filter(Boolean);
  clean.forEach((url) => window.open(url, "_blank"));
}

function looksLikeCatalogQuery(text) {
  return isLikelyCatalogQuery(text);
}

function extractCatalogFilters(text) {
  return {
    raw_query: text,
  };
}

function formatCatalogReply(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "Non ho trovato prodotti compatibili con la richiesta nel catalogo New Form.";
  }

  return `Ho trovato ${results.length} prodotti compatibili.\n\nTi lascio qui sotto le anteprime dei prodotti.`;
}

function App() {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CONVERSATIONS);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map(normalizeConversation)
            .filter(Boolean)
            .sort((a, b) => b.updatedAt - a.updatedAt);

          if (normalized.length > 0) return normalized;
        }
      } catch {
        // ignore
      }
    }

    return [createConversation()];
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    return localStorage.getItem(STORAGE_ACTIVE_CONVERSATION) || null;
  });

  const [profile, setProfile] = useState(() => {
    const savedProfile = localStorage.getItem(STORAGE_PROFILE);

    if (savedProfile) {
      try {
        return { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) };
      } catch {
        return DEFAULT_PROFILE;
      }
    }

    return DEFAULT_PROFILE;
  });

  const [canvaStatus, setCanvaStatus] = useState({
    connected: false,
    expiresAt: null,
    scopes: null,
  });
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaError, setCanvaError] = useState("");
  const [canvaDesign, setCanvaDesign] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CANVA_LAST_DESIGN);

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }

    return null;
  });

  const [designWidth, setDesignWidth] = useState("1080");
  const [designHeight, setDesignHeight] = useState("1350");
  const [designUnit, setDesignUnit] = useState("px");

  const [exportFormat, setExportFormat] = useState("png");
  const [exportPages, setExportPages] = useState("");
  const [exportQuality, setExportQuality] = useState("regular");
  const [exportWidth, setExportWidth] = useState("");
  const [exportHeight, setExportHeight] = useState("");
  const [jpgQuality, setJpgQuality] = useState("90");
  const [pdfSize, setPdfSize] = useState("a4");
  const [pngLossless, setPngLossless] = useState(true);
  const [pngTransparent, setPngTransparent] = useState(false);
  const [pngAsSingleImage, setPngAsSingleImage] = useState(false);
  const [mp4Quality, setMp4Quality] = useState("horizontal_1080p");

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("Sto preparando Zeus...");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appMode, setAppMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_APP_MODE);
    if (saved === APP_MODES.DEMMA) return APP_MODES.DEMMA;
    return saved === APP_MODES.NEWFORM ? APP_MODES.NEWFORM : APP_MODES.ZEUS;
  });

  const [activePage, setActivePage] = useState("chat");
  const [newFormCatalogQuery, setNewFormCatalogQuery] = useState("");
  const [newFormCatalogDraft, setNewFormCatalogDraft] = useState("");
  const [newFormCatalogCategory, setNewFormCatalogCategory] = useState("Tutte");
  const [newFormCatalogProducts, setNewFormCatalogProducts] = useState([]);
  const [newFormCatalogAllProducts, setNewFormCatalogAllProducts] = useState([]);
  const [newFormCatalogLoading, setNewFormCatalogLoading] = useState(false);
  const [newFormCatalogError, setNewFormCatalogError] = useState("");
  const [newFormCatalogVisibleCount, setNewFormCatalogVisibleCount] = useState(24);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  const currentConversation = useMemo(() => {
    return (
      conversations.find((conv) => conv.id === activeConversationId) ||
      conversations[0] ||
      null
    );
  }, [conversations, activeConversationId]);

  const messages = currentConversation?.messages || [];

  const creatorName = useMemo(() => {
    return profile.creatorName || null;
  }, [profile.creatorName]);

  const effectiveMode = currentConversation?.mode || appMode;
  const isNewFormMode = effectiveMode === APP_MODES.NEWFORM;
  const isDemmaMode = effectiveMode === APP_MODES.DEMMA;
  const isCatalogMode = isNewFormMode || isDemmaMode;
  const activeCatalogKey = isDemmaMode ? "demma" : "newform";
  const isNewFormCatalogPage = activePage === "newform-catalog" && isNewFormMode;

  const newFormCatalogCategories = useMemo(() => {
    const counts = new Map();

    newFormCatalogAllProducts.forEach((product) => {
      const category = String(product.category || "Altro").trim() || "Altro";
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return [
      { name: "Tutte", count: newFormCatalogAllProducts.length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [newFormCatalogAllProducts]);

  const assistantName = isDemmaMode ? "Ted" : isNewFormMode ? "Pino" : "Zeus";
  const assistantSubtitle = isDemmaMode
    ? "Assistente catalogo Demma"
    : isNewFormMode
      ? "Assistente catalogo New Form"
      : "AI personale";

  const topbarTitle = isNewFormCatalogPage
    ? "Catalogo New Form"
    : currentConversation?.title || "Zeus";

  const topbarSubtitle = isNewFormCatalogPage
    ? "Tutti i prodotti · categorie · ricerca con Pino"
    : isDemmaMode
      ? "Catalogo Demma · ricerca prodotti"
      : isNewFormMode
        ? "Catalogo New Form · ricerca prodotti"
        : "Chat personale con memoria, ricerca e fonti";

  const composerPlaceholder = isDemmaMode
    ? "Scrivi a Ted cosa cerchi nel catalogo Demma..."
    : isNewFormMode
      ? "Scrivi a Pino cosa cerchi nel catalogo New Form..."
      : "Scrivi un messaggio a Zeus...";

  const statusLabel = useMemo(() => {
    return getStatusLabel(statusText, isLoading, assistantName);
  }, [statusText, isLoading, assistantName]);

  const refreshCanvaStatus = useCallback(async () => {
    try {
      const data = await getCanvaStatus();
      setCanvaStatus({
        connected: Boolean(data?.connected),
        expiresAt: data?.expiresAt || null,
        scopes: data?.scopes || null,
      });
    } catch (error) {
      console.error(error);
      setCanvaStatus({
        connected: false,
        expiresAt: null,
        scopes: null,
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(STORAGE_ACTIVE_CONVERSATION, activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_APP_MODE, appMode);
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (canvaDesign) {
      localStorage.setItem(
        STORAGE_CANVA_LAST_DESIGN,
        JSON.stringify(canvaDesign)
      );
    } else {
      localStorage.removeItem(STORAGE_CANVA_LAST_DESIGN);
    }
  }, [canvaDesign]);

  useEffect(() => {
    const initZeus = async () => {
      try {
        await loadZeusEngine(setStatusText);
        setStatusText("Zeus è pronto");
      } catch (error) {
        console.error(error);
        setStatusText(
          "Server Zeus temporaneamente lento. Puoi riprovare tra poco."
        );
      }
    };

    initZeus();
    refreshCanvaStatus();
  }, [refreshCanvaStatus]);

  useEffect(() => {
    function handleMessage(event) {
      if (event?.data?.type === "CANVA_CONNECTED") {
        refreshCanvaStatus();
        setCanvaError("");
      }

      if (event?.data?.type === "CANVA_ERROR") {
        setCanvaError(event?.data?.message || "Errore collegamento Canva");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshCanvaStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeConversationId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    if (!isNewFormMode && activePage === "newform-catalog") {
      setActivePage("chat");
    }
  }, [activePage, isNewFormMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadNewFormCatalog() {
      if (!isNewFormCatalogPage) return;

      try {
        setNewFormCatalogLoading(true);
        setNewFormCatalogError("");

        const allProducts =
          newFormCatalogAllProducts.length > 0
            ? newFormCatalogAllProducts
            : await searchCatalog({ raw_query: "" }, { catalogKey: "newform" });

        const selectedCategory =
          newFormCatalogCategory === "Tutte" ? null : newFormCatalogCategory;

        const filteredProducts =
          !newFormCatalogQuery && selectedCategory
            ? allProducts.filter(
                (product) =>
                  String(product.category || "").trim() === selectedCategory
              )
            : await searchCatalog(
                {
                  raw_query: newFormCatalogQuery,
                  category: selectedCategory || undefined,
                },
                { catalogKey: "newform" }
              );

        if (cancelled) return;

        if (newFormCatalogAllProducts.length === 0) {
          setNewFormCatalogAllProducts(allProducts);
        }

        setNewFormCatalogProducts(filteredProducts);
        setNewFormCatalogVisibleCount(24);
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setNewFormCatalogError(
            error?.message || "Errore durante il caricamento del catalogo New Form."
          );
        }
      } finally {
        if (!cancelled) {
          setNewFormCatalogLoading(false);
        }
      }
    }

    const debounceId = window.setTimeout(loadNewFormCatalog, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
    };
  }, [
    isNewFormCatalogPage,
    newFormCatalogAllProducts,
    newFormCatalogQuery,
    newFormCatalogCategory,
  ]);

  function patchConversation(conversationId, updater) {
    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (conv.id !== conversationId) return conv;
        return updater(conv);
      });

      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }

  function appendMessageToConversation(conversationId, message) {
    patchConversation(conversationId, (conv) => ({
      ...conv,
      messages: [...conv.messages, message],
      updatedAt: Date.now(),
    }));
  }

  function createNewChat(mode = effectiveMode) {
    setActivePage("chat");
    const title =
      mode === APP_MODES.DEMMA
        ? "Demma"
        : mode === APP_MODES.NEWFORM
          ? "New Form"
          : "Nuova chat";
    const newConversation = createConversation(title, mode);
    setAppMode(mode);
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setInput("");
  }

  function switchToZeusMode() {
    setAppMode(APP_MODES.ZEUS);
    setActivePage("chat");
    const newConversation = createConversation("Nuova chat", APP_MODES.ZEUS);
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setInput("");
    setStatusText("Zeus è pronto");
  }

  function switchToNewFormMode() {
    setAppMode(APP_MODES.NEWFORM);
    setActivePage("chat");
    const newConversation = createConversation("New Form", APP_MODES.NEWFORM);
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setInput("");
    setStatusText("Pino è pronto");
  }

  function openNewFormCatalogPage() {
    setAppMode(APP_MODES.NEWFORM);
    setActivePage("newform-catalog");
    setStatusText("Pino è pronto");
  }

  function closeNewFormCatalogPage() {
    setActivePage("chat");
  }

  function switchToDemmaMode() {
    setAppMode(APP_MODES.DEMMA);
    setActivePage("chat");
    const newConversation = createConversation("Demma", APP_MODES.DEMMA);
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setInput("");
    setStatusText("Ted è pronto");
  }

  function openConversation(conversation) {
    setActivePage("chat");
    setActiveConversationId(conversation.id);
    setAppMode(
      conversation.mode === APP_MODES.DEMMA
        ? APP_MODES.DEMMA
        : conversation.mode === APP_MODES.NEWFORM
          ? APP_MODES.NEWFORM
          : APP_MODES.ZEUS
    );
  }

  function deleteConversation(conversationId) {
    const confirmed = window.confirm(
      "Vuoi davvero eliminare questa conversazione?"
    );

    if (!confirmed) return;

    setConversations((prev) => {
      const filtered = prev.filter((conv) => conv.id !== conversationId);

      if (filtered.length === 0) {
        const fresh = createConversation();
        setActiveConversationId(fresh.id);
        return [fresh];
      }

      if (conversationId === activeConversationId) {
        setActiveConversationId(filtered[0].id);
      }

      return filtered;
    });
  }

  function resetMemory() {
    const confirmed = window.confirm(
      "Vuoi davvero azzerare la memoria di Zeus?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_PROFILE);
    setProfile(DEFAULT_PROFILE);
  }

  async function handleCreateDesign() {
    const widthPx = convertToPx(designWidth, designUnit);
    const heightPx = convertToPx(designHeight, designUnit);

    if (!widthPx || !heightPx) {
      setCanvaError("Inserisci dimensioni valide.");
      return;
    }

    try {
      setCanvaBusy(true);
      setCanvaError("");

      const data = await createCanvaDesign({
        title: `Design Zeus ${new Date().toLocaleDateString("it-IT")}`,
        width: widthPx,
        height: heightPx,
      });

      const design = data?.design || null;

      if (!design) {
        throw new Error("Design Canva non creato");
      }

      setCanvaDesign(design);

      if (design?.urls?.edit_url) {
        window.open(design.urls.edit_url, "_blank");
      }
    } catch (error) {
      console.error(error);
      setCanvaError(error?.message || "Errore creazione design Canva");
    } finally {
      setCanvaBusy(false);
    }
  }

  function handleOpenCanvaDesign() {
    if (!canvaDesign?.urls?.edit_url) {
      setCanvaError("Nessun design Canva disponibile.");
      return;
    }

    setCanvaError("");
    window.open(canvaDesign.urls.edit_url, "_blank");
  }

  async function handleExport() {
    if (!canvaDesign?.id) {
      setCanvaError("Nessun design Canva da esportare.");
      return;
    }

    try {
      setCanvaBusy(true);
      setCanvaError("");

      const pages = parsePagesInput(exportPages);
      const options = {};

      if (pages) {
        options.pages = pages;
      }

      if (["pdf", "jpg", "png", "gif", "mp4"].includes(exportFormat)) {
        options.exportQuality = exportQuality;
      }

      if (exportFormat === "pdf") {
        options.size = pdfSize;
      }

      if (["jpg", "png", "gif"].includes(exportFormat)) {
        if (exportWidth.trim()) options.width = Number(exportWidth);
        if (exportHeight.trim()) options.height = Number(exportHeight);
      }

      if (exportFormat === "jpg") {
        options.quality = Number(jpgQuality || 90);
      }

      if (exportFormat === "png") {
        options.lossless = pngLossless;
        options.transparentBackground = pngTransparent;
        options.asSingleImage = pngAsSingleImage;
      }

      if (exportFormat === "mp4") {
        options.quality = mp4Quality;
      }

      const start = await createCanvaExport({
        designId: canvaDesign.id,
        formatType: exportFormat,
        options,
      });

      const exportId = start?.job?.id;

      if (!exportId) {
        throw new Error("Export Canva non avviato");
      }

      const result = await pollCanvaExport(exportId, {
        intervalMs: 2000,
        maxAttempts: 40,
      });

      const urls = Array.isArray(result?.job?.urls) ? result.job.urls : [];

      if (urls.length === 0) {
        throw new Error("Export completato ma senza link di download");
      }

      openUrls(urls);
    } catch (error) {
      console.error(error);
      setCanvaError(error?.message || "Errore export Canva");
    } finally {
      setCanvaBusy(false);
    }
  }

  function handleNewFormCatalogSubmit(e) {
    e.preventDefault();
    setNewFormCatalogQuery(newFormCatalogDraft.trim());
  }

  function handleNewFormCategoryClick(categoryName) {
    setNewFormCatalogCategory(categoryName);
  }

  function handleClearNewFormCatalogSearch() {
    setNewFormCatalogDraft("");
    setNewFormCatalogQuery("");
    setNewFormCatalogCategory("Tutte");
  }

  function handleAskPinoFromCatalog() {
    const query = newFormCatalogDraft.trim() || newFormCatalogQuery.trim();
    const categoryPart =
      newFormCatalogCategory !== "Tutte" ? ` nella categoria ${newFormCatalogCategory}` : "";
    const message = query
      ? `${query}${categoryPart}`
      : `Mostrami prodotti New Form${categoryPart}`;

    setActivePage("chat");
    setInput(message);
    setStatusText("Pino è pronto");

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }

  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || isLoading || !currentConversation) return;

    const userText = input.trim();
    const conversationId = currentConversation.id;
    const previousMessages = [...currentConversation.messages];

    const userMessage = {
      sender: "user",
      text: userText,
      products: [],
    };

    const activeMode = isDemmaMode
      ? APP_MODES.DEMMA
      : isNewFormMode
        ? APP_MODES.NEWFORM
        : APP_MODES.ZEUS;
    let updates = null;
    let updatedProfile = profile;

    if (!isCatalogMode) {
      updates = extractProfileUpdates(userText);
      updatedProfile = applyProfileUpdates(profile, updates);

      if (JSON.stringify(updatedProfile) !== JSON.stringify(profile)) {
        setProfile(updatedProfile);
      }
    }

    patchConversation(conversationId, (conv) => {
      const userMessagesCount = conv.messages.filter(
        (msg) => msg.sender === "user"
      ).length;

      const shouldRename =
        conv.title === "Nuova chat" ||
        conv.title === "New Form" ||
        conv.title === "Demma" ||
        userMessagesCount === 0;

      return {
        ...conv,
        mode: activeMode,
        title: shouldRename ? getConversationTitle(userText) : conv.title,
        messages: [...conv.messages, userMessage],
        updatedAt: Date.now(),
      };
    });

    setInput("");
    setIsLoading(true);
    setStatusText(
      isDemmaMode
        ? "Ted sta cercando nel catalogo..."
        : isNewFormMode
          ? "Pino sta cercando nel catalogo..."
          : "Zeus sta scrivendo..."
    );

    try {
      if (isCatalogMode) {
        const filters = extractCatalogFilters(userText);
        const catalogGreeting = userText.toLowerCase().trim();

        if (
          [
            "ciao",
            "salve",
            "buongiorno",
            "buonasera",
            "buon giorno",
            "buona sera",
            "hey",
            "ei",
            "hello",
            "hi",
          ].includes(catalogGreeting)
        ) {
          appendMessageToConversation(conversationId, {
            sender: "zeus",
            text: isDemmaMode
              ? "Ciao, sono Ted. Dimmi cosa cerchi nel catalogo Demma: posso aiutarti con pannolini, latte, salviette, prodotti baby, puericultura, alimentari, cosmetica, casa e molto altro."
              : "Ciao, sono Pino. Dimmi cosa cerchi nel catalogo New Form: posso aiutarti con uomo, donna, bambino, bambina, brand, colore, taglia e prezzo.",
            grounded: false,
            searchQueries: [],
            sources: [],
            products: [],
          });

          setStatusText(isDemmaMode ? "Ted è pronto" : "Pino è pronto");
          return;
        }

        const results = await searchCatalog(filters, { catalogKey: activeCatalogKey });
        const catalogName = isDemmaMode ? "Demma" : "New Form";
        const catalogAssistantName = isDemmaMode ? "Ted" : "Pino";

        let catalogReply =
          results.length > 0
            ? `Ho trovato ${results.length} prodotti compatibili nel catalogo ${catalogName}. Ti lascio qui sotto le anteprime.`
            : isDemmaMode
              ? "Non ho trovato prodotti compatibili nel catalogo Demma. Prova a specificare meglio categoria, marca, prodotto, prezzo o disponibilità."
              : "Non ho trovato prodotti compatibili nel catalogo New Form. Prova a specificare meglio il tipo di capo, il reparto (uomo, donna, bambino, bambina), il brand, il colore, la taglia o il prezzo.";

        if (results.length > 0) {
          try {
            const aiCatalogReply = await getCatalogAiReply({
              userText,
              products: results,
              catalogName,
              assistantName: catalogAssistantName,
              setStatusText,
            });

            if (aiCatalogReply?.reply) {
              catalogReply = aiCatalogReply.reply;
            }
          } catch (catalogBrainError) {
            console.error(catalogBrainError);
            catalogReply = `${catalogReply}\n\nNota: il ragionamento AI sul catalogo non è disponibile ora, quindi ti mostro comunque i prodotti trovati.`;
          }
        }

        appendMessageToConversation(conversationId, {
          sender: "zeus",
          text: catalogReply,
          grounded: false,
          searchQueries: [],
          sources: [],
          products: results,
        });

        setStatusText(isDemmaMode ? "Ted è pronto" : "Pino è pronto");
        return;
      }

      const deterministicReply = getDeterministicReply(
        userText,
        updatedProfile,
        updates
      );

      if (deterministicReply) {
        appendMessageToConversation(conversationId, {
          sender: "zeus",
          text: deterministicReply,
          grounded: false,
          searchQueries: [],
          sources: [],
          products: [],
        });

        setStatusText("Zeus è pronto");
        return;
      }

      if (looksLikeCatalogQuery(userText)) {
        const filters = extractCatalogFilters(userText);
        const results = await searchCatalog(filters);

        appendMessageToConversation(conversationId, {
          sender: "zeus",
          text: formatCatalogReply(results),
          grounded: false,
          searchQueries: [],
          sources: [],
          products: results,
        });

        setStatusText("Zeus è pronto");
        return;
      }

      const aiReply = await getZeusAiReply(
        userText,
        previousMessages,
        updatedProfile,
        setStatusText
      );

      const normalized = normalizeAssistantPayload(aiReply);

      appendMessageToConversation(conversationId, {
        sender: "zeus",
        text: normalized.text,
        grounded: normalized.grounded,
        searchQueries: normalized.searchQueries,
        sources: normalized.sources,
        products: [],
      });

      setStatusText("Zeus è pronto");
    } catch (error) {
      console.error(error);

      appendMessageToConversation(conversationId, {
        sender: "zeus",
        text:
          error?.message ||
          "Il server di Zeus non è raggiungibile in questo momento.",
        grounded: false,
        searchQueries: [],
        sources: [],
        products: [],
      });

      setStatusText(
        isDemmaMode
          ? "Connessione a Ted non riuscita"
          : isNewFormMode
            ? "Connessione a Pino non riuscita"
            : "Connessione a Zeus non riuscita"
      );
    } finally {
      setIsLoading(false);
    }
  };

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (!isLoading && input.trim()) {
        handleSend(e);
      }
    }
  }

  return (
    <div
      className={`app-shell ${
        isDemmaMode ? "mode-demma" : isNewFormMode ? "mode-newform" : "mode-zeus"
      }`}
    >
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-top">
          <div className="brand">
            <BrandLogo mode={effectiveMode} />
            <div className="brand-copy">
              <div className="brand-title">
                {isDemmaMode ? "Demma" : isNewFormMode ? "New Form" : "Zeus"}
              </div>
              <div className="brand-subtitle">{assistantSubtitle}</div>
            </div>
          </div>

          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? "Chiudi" : "Apri"}
          </button>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={() => createNewChat(effectiveMode)}
        >
          + Nuova chat
        </button>

        <div className="mode-switch-group">
          {!isNewFormMode && (
            <button
              className="mode-switch-button newform-switch"
              type="button"
              onClick={switchToNewFormMode}
            >
              New Form
            </button>
          )}

          {!isDemmaMode && (
            <button
              className="mode-switch-button demma-switch"
              type="button"
              onClick={switchToDemmaMode}
            >
              Demma
            </button>
          )}

          {isNewFormMode && (
            <button
              className={`mode-switch-button catalog-page-switch ${
                isNewFormCatalogPage ? "active" : ""
              }`}
              type="button"
              onClick={openNewFormCatalogPage}
            >
              Catalogo prodotti
            </button>
          )}

          {isNewFormCatalogPage && (
            <button
              className="mode-switch-button zeus-switch"
              type="button"
              onClick={closeNewFormCatalogPage}
            >
              ← Torna alla chat Pino
            </button>
          )}

          {isCatalogMode && (
            <button
              className="mode-switch-button zeus-switch"
              type="button"
              onClick={switchToZeusMode}
            >
              ← Torna a Zeus
            </button>
          )}
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Stato</div>
          <div className="status-pill">{statusLabel}</div>
        </div>

        {!isCatalogMode && (
          <div className="sidebar-card">
            <div className="sidebar-card-label">Creatore</div>
            <div className="creator-box">
              {creatorName || "Non ancora memorizzato"}
            </div>
          </div>
        )}

        {!isCatalogMode && (
          <div className="sidebar-card">
            <div className="sidebar-card-label">Canva</div>

            <div className="canva-status-row">
            <span
              className={`canva-dot ${
                canvaStatus.connected ? "connected" : "disconnected"
              }`}
            ></span>
            <span className="canva-status-text">
              {canvaStatus.connected ? "Connesso" : "Non collegato"}
            </span>
          </div>

          {!canvaStatus.connected ? (
            <div className="canva-actions">
              <button
                type="button"
                className="canva-primary-button"
                onClick={() => {
                  try {
                    setCanvaError("");
                    startCanvaConnect(async () => {
                      await refreshCanvaStatus();
                    });
                  } catch (error) {
                    setCanvaError(
                      error?.message || "Errore apertura popup Canva"
                    );
                  }
                }}
                disabled={canvaBusy}
              >
                Collega Canva
              </button>
            </div>
          ) : (
            <>
              <div className="canva-section-title">Crea design</div>

              <div className="canva-dimensions">
                <div className="canva-input-group">
                  <label>Larghezza</label>
                  <input
                    className="canva-number-input"
                    type="number"
                    min="1"
                    value={designWidth}
                    onChange={(e) => setDesignWidth(e.target.value)}
                  />
                </div>

                <div className="canva-input-group">
                  <label>Altezza</label>
                  <input
                    className="canva-number-input"
                    type="number"
                    min="1"
                    value={designHeight}
                    onChange={(e) => setDesignHeight(e.target.value)}
                  />
                </div>

                <div className="canva-input-group unit">
                  <label>Unità</label>
                  <select
                    className="canva-unit-select"
                    value={designUnit}
                    onChange={(e) => setDesignUnit(e.target.value)}
                  >
                    <option value="px">px</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </div>

              <div className="canva-actions">
                <button
                  type="button"
                  className="canva-primary-button"
                  onClick={handleCreateDesign}
                  disabled={canvaBusy}
                >
                  {canvaBusy ? "Attendi..." : "Crea design"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenCanvaDesign}
                  disabled={canvaBusy || !canvaDesign?.urls?.edit_url}
                >
                  Apri ultimo design
                </button>
              </div>

              <div className="canva-section-title export-top">Export</div>

              <div className="canva-export-grid">
                <div className="canva-input-group full">
                  <label>Formato</label>
                  <select
                    className="canva-unit-select"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="pdf">PDF</option>
                    <option value="gif">GIF</option>
                    <option value="pptx">PPTX</option>
                    <option value="mp4">MP4</option>
                    <option value="html_bundle">HTML bundle</option>
                    <option value="html_standalone">HTML standalone</option>
                  </select>
                </div>

                <div className="canva-input-group full">
                  <label>Pagine</label>
                  <input
                    className="canva-number-input"
                    type="text"
                    placeholder="es. 1,3-5"
                    value={exportPages}
                    onChange={(e) => setExportPages(e.target.value)}
                  />
                </div>

                {["pdf", "jpg", "png", "gif", "mp4"].includes(exportFormat) && (
                  <div className="canva-input-group full">
                    <label>Qualità export</label>
                    <select
                      className="canva-unit-select"
                      value={exportQuality}
                      onChange={(e) => setExportQuality(e.target.value)}
                    >
                      <option value="regular">regular</option>
                      <option value="pro">pro</option>
                    </select>
                  </div>
                )}

                {exportFormat === "pdf" && (
                  <div className="canva-input-group full">
                    <label>Formato carta</label>
                    <select
                      className="canva-unit-select"
                      value={pdfSize}
                      onChange={(e) => setPdfSize(e.target.value)}
                    >
                      <option value="a4">A4</option>
                      <option value="a3">A3</option>
                      <option value="letter">Letter</option>
                      <option value="legal">Legal</option>
                    </select>
                  </div>
                )}

                {["jpg", "png", "gif"].includes(exportFormat) && (
                  <>
                    <div className="canva-input-group">
                      <label>Larghezza px</label>
                      <input
                        className="canva-number-input"
                        type="number"
                        min="40"
                        value={exportWidth}
                        onChange={(e) => setExportWidth(e.target.value)}
                        placeholder="auto"
                      />
                    </div>

                    <div className="canva-input-group">
                      <label>Altezza px</label>
                      <input
                        className="canva-number-input"
                        type="number"
                        min="40"
                        value={exportHeight}
                        onChange={(e) => setExportHeight(e.target.value)}
                        placeholder="auto"
                      />
                    </div>
                  </>
                )}

                {exportFormat === "jpg" && (
                  <div className="canva-input-group full">
                    <label>Compressione JPG</label>
                    <input
                      className="canva-number-input"
                      type="number"
                      min="1"
                      max="100"
                      value={jpgQuality}
                      onChange={(e) => setJpgQuality(e.target.value)}
                    />
                  </div>
                )}

                {exportFormat === "png" && (
                  <div className="canva-checks">
                    <label className="canva-check">
                      <input
                        type="checkbox"
                        checked={pngLossless}
                        onChange={(e) => setPngLossless(e.target.checked)}
                      />
                      <span>Lossless</span>
                    </label>

                    <label className="canva-check">
                      <input
                        type="checkbox"
                        checked={pngTransparent}
                        onChange={(e) => setPngTransparent(e.target.checked)}
                      />
                      <span>Sfondo trasparente</span>
                    </label>

                    <label className="canva-check">
                      <input
                        type="checkbox"
                        checked={pngAsSingleImage}
                        onChange={(e) => setPngAsSingleImage(e.target.checked)}
                      />
                      <span>Unica immagine</span>
                    </label>
                  </div>
                )}

                {exportFormat === "mp4" && (
                  <div className="canva-input-group full">
                    <label>Preset video</label>
                    <select
                      className="canva-unit-select"
                      value={mp4Quality}
                      onChange={(e) => setMp4Quality(e.target.value)}
                    >
                      <option value="horizontal_480p">horizontal_480p</option>
                      <option value="horizontal_720p">horizontal_720p</option>
                      <option value="horizontal_1080p">horizontal_1080p</option>
                      <option value="horizontal_4k">horizontal_4k</option>
                      <option value="vertical_480p">vertical_480p</option>
                      <option value="vertical_720p">vertical_720p</option>
                      <option value="vertical_1080p">vertical_1080p</option>
                      <option value="vertical_4k">vertical_4k</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="canva-actions">
                <button
                  type="button"
                  className="canva-primary-button"
                  onClick={handleExport}
                  disabled={canvaBusy || !canvaDesign?.id}
                >
                  {canvaBusy ? "Export..." : "Esporta"}
                </button>
              </div>
            </>
          )}

            {canvaError && <div className="canva-error">{canvaError}</div>}
          </div>
        )}

        <div className="sidebar-card conversations-card">
          <div className="sidebar-card-label">Conversazioni</div>

          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  conversation.id === currentConversation?.id ? "active" : ""
                }`}
              >
                <button
                  type="button"
                  className="conversation-main"
                  onClick={() => openConversation(conversation)}
                >
                  <div className="conversation-item-title">
                    {conversation.title}
                  </div>
                  <div className="conversation-item-preview">
                    {conversation.messages[conversation.messages.length - 1]
                      ?.text?.slice(0, 60) || "Conversazione vuota"}
                  </div>
                </button>

                <button
                  type="button"
                  className="conversation-delete"
                  onClick={() => deleteConversation(conversation.id)}
                  title="Elimina conversazione"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {!isCatalogMode && (
          <div className="sidebar-card memory-card">
            <div className="sidebar-card-label">Memoria</div>
            <button
              className="secondary-button"
              type="button"
              onClick={resetMemory}
            >
              Azzera memoria di Zeus
            </button>
          </div>
        )}
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>

          <div>
            <div className="topbar-title">
              {topbarTitle}
            </div>
            <div className="topbar-subtitle">{topbarSubtitle}</div>
          </div>
        </header>

        {isNewFormCatalogPage ? (
          <section className="catalog-page">
            <div className="catalog-hero">
              <div className="catalog-hero-copy">
                <div className="catalog-kicker">New Form · Pino</div>
                <h1>Tutti i prodotti New Form</h1>
                <p>
                  Cerca per nome, brand, colore, taglia, reparto o categoria.
                  Pino usa la stessa logica intelligente della chat catalogo.
                </p>
              </div>

              <form className="catalog-search-box" onSubmit={handleNewFormCatalogSubmit}>
                <div className="catalog-search-label">Cerca con Pino</div>
                <div className="catalog-search-row">
                  <input
                    type="search"
                    value={newFormCatalogDraft}
                    onChange={(e) => setNewFormCatalogDraft(e.target.value)}
                    placeholder="Es. maglia tommy donna, scarpe 39, giacca nera..."
                  />
                  <button type="submit">Cerca</button>
                </div>
                <div className="catalog-search-actions">
                  <button
                    type="button"
                    className="catalog-soft-button"
                    onClick={handleAskPinoFromCatalog}
                  >
                    Chiedi in chat a Pino
                  </button>
                  <button
                    type="button"
                    className="catalog-soft-button"
                    onClick={handleClearNewFormCatalogSearch}
                  >
                    Pulisci filtri
                  </button>
                </div>
              </form>
            </div>

            <div className="catalog-category-bar" aria-label="Categorie New Form">
              {newFormCatalogCategories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className={`catalog-category-chip ${
                    newFormCatalogCategory === category.name ? "active" : ""
                  }`}
                  onClick={() => handleNewFormCategoryClick(category.name)}
                >
                  <span>{category.name}</span>
                  <strong>{category.count}</strong>
                </button>
              ))}
            </div>

            <div className="catalog-results-head">
              <div>
                <strong>{newFormCatalogProducts.length}</strong> prodotti trovati
                {newFormCatalogQuery && (
                  <span> per “{newFormCatalogQuery}”</span>
                )}
                {newFormCatalogCategory !== "Tutte" && (
                  <span> · categoria {newFormCatalogCategory}</span>
                )}
              </div>

              {newFormCatalogLoading && (
                <div className="catalog-loading-pill">Pino sta cercando...</div>
              )}
            </div>

            {newFormCatalogError ? (
              <div className="catalog-error">{newFormCatalogError}</div>
            ) : (
              <ProductCatalogGrid
                products={newFormCatalogProducts}
                visibleCount={newFormCatalogVisibleCount}
                onLoadMore={() =>
                  setNewFormCatalogVisibleCount((prev) => prev + 24)
                }
              />
            )}
          </section>
        ) : (
          <>
            <section className="chat-area">
              <div className="chat-inner">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`message-row ${
                      message.sender === "user" ? "user-row" : "assistant-row"
                    }`}
                  >
                    {message.sender === "zeus" && (
                      <div className="assistant-avatar-wrap">
                        <AssistantAvatar mode={effectiveMode} />
                      </div>
                    )}

                    <div
                      className={`message-bubble ${
                        message.sender === "user"
                          ? "user-bubble"
                          : "assistant-bubble"
                      }`}
                    >
                      {message.sender === "zeus" ? (
                        <>
                          <div className="assistant-name">{assistantName}</div>

                          <div className="assistant-markdown">
                            <MarkdownMessage text={message.text} />
                          </div>

                          {message.products?.length > 0 && (
                            <ProductShoppingRail products={message.products} />
                          )}

                          {message.grounded && (
                            <div className="web-badge">
                              {message.products?.length > 0
                                ? isDemmaMode
                                  ? "Catalogo Demma"
                                  : "Catalogo New Form"
                                : "Risposta verificata sul web"}
                            </div>
                          )}

                          {message.sources?.length > 0 && (
                            <div className="sources-block">
                              <div className="sources-title">Fonti</div>

                              <div className="sources-list">
                                {message.sources.map((source, sourceIndex) => (
                                  <a
                                    key={`${source.url}-${sourceIndex}`}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="source-link"
                                  >
                                    {source.title || source.url}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="user-text">{message.text}</div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="message-row assistant-row">
                    <div className="assistant-avatar-wrap">
                      <AssistantAvatar mode={effectiveMode} />
                    </div>

                    <div className="message-bubble assistant-bubble">
                      <div className="assistant-name">{assistantName}</div>
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef}></div>
              </div>
            </section>

            <footer className="composer-wrap">
              <form className="composer" onSubmit={handleSend}>
                <textarea
                  ref={textareaRef}
                  placeholder={composerPlaceholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />

                <div className="composer-bottom">
                  <div className="composer-hint">
                    Invio per inviare · Shift+Invio per andare a capo
                  </div>

                  <button
                    className="send-button"
                    type="submit"
                    disabled={isLoading || !input.trim()}
                  >
                    Invia
                  </button>
                </div>
              </form>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

export default App;