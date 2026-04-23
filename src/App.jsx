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
import { getZeusAiReply, loadZeusEngine } from "./services/zeusAiReply";
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

const STORAGE_CONVERSATIONS = "zeus_conversations";
const STORAGE_ACTIVE_CONVERSATION = "zeus_active_conversation";
const STORAGE_PROFILE = "zeus_profile";
const STORAGE_CANVA_LAST_DESIGN = "zeus_canva_last_design";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeMessage() {
  return {
    sender: "zeus",
    text: "Ciao. Sono Zeus. Ti aiuto in italiano con idee, organizzazione, scrittura e ricerche online con fonti.",
    grounded: false,
    searchQueries: [],
    sources: [],
  };
}

function createConversation(title = "Nuova chat") {
  const now = Date.now();

  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [createWelcomeMessage()],
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
  };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== "object") return null;

  const normalizedMessages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter(Boolean)
    : [];

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : "Nuova chat",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    messages:
      normalizedMessages.length > 0
        ? normalizedMessages
        : [createWelcomeMessage()],
  };
}

function normalizeAssistantPayload(payload) {
  if (typeof payload === "string") {
    return {
      text: payload,
      grounded: false,
      searchQueries: [],
      sources: [],
    };
  }

  return {
    text: payload?.reply || "Non sono riuscito a generare una risposta valida.",
    grounded: Boolean(payload?.grounded),
    searchQueries: Array.isArray(payload?.searchQueries)
      ? payload.searchQueries
      : [],
    sources: Array.isArray(payload?.sources) ? payload.sources : [],
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

function ZeusLogo() {
  return (
    <div className="zeus-logo">
      <div className="zeus-logo-core">Z</div>
    </div>
  );
}

function getStatusLabel(statusText, isLoading) {
  const lower = statusText.toLowerCase();

  if (isLoading) return "Zeus sta scrivendo...";
  if (lower.includes("pronto")) return "Zeus è pronto";

  if (
    lower.includes("riattivando") ||
    lower.includes("risvegliando") ||
    lower.includes("collegando") ||
    lower.includes("lento")
  ) {
    return "Zeus si sta risvegliando...";
  }

  if (lower.includes("connessione")) return "Connessione a Zeus non riuscita";

  return statusText;
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
  const [canvaNotice, setCanvaNotice] = useState("");
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

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("Sto preparando Zeus...");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const statusLabel = useMemo(() => {
    return getStatusLabel(statusText, isLoading);
  }, [statusText, isLoading]);

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
    const params = new URLSearchParams(window.location.search);
    const canvaConnected = params.get("canva");
    const canvaError = params.get("canva_error");

    if (canvaConnected === "connected") {
      setCanvaNotice("Canva collegato con successo.");
      refreshCanvaStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (canvaError) {
      setCanvaNotice(decodeURIComponent(canvaError));
      window.history.replaceState({}, "", window.location.pathname);
    }
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

  function createNewChat() {
    const newConversation = createConversation();
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setInput("");
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

  async function handleCreateInstagramDesign() {
    try {
      setCanvaBusy(true);
      setCanvaNotice("");

      const data = await createCanvaDesign({
        title: `Post Instagram Zeus ${new Date().toLocaleDateString("it-IT")}`,
        width: 1080,
        height: 1350,
      });

      const design = data?.design || null;

      if (!design) {
        throw new Error("Design Canva non creato");
      }

      setCanvaDesign(design);
      setCanvaNotice("Design Canva creato con successo.");

      if (design?.urls?.edit_url) {
        window.open(design.urls.edit_url, "_blank");
      }
    } catch (error) {
      console.error(error);
      setCanvaNotice(error?.message || "Errore creazione design Canva");
    } finally {
      setCanvaBusy(false);
    }
  }

  function handleOpenCanvaDesign() {
    if (!canvaDesign?.urls?.edit_url) {
      setCanvaNotice("Nessun design Canva apribile trovato.");
      return;
    }

    window.open(canvaDesign.urls.edit_url, "_blank");
  }

  async function handleExportLastDesign() {
    if (!canvaDesign?.id) {
      setCanvaNotice("Nessun design Canva disponibile da esportare.");
      return;
    }

    try {
      setCanvaBusy(true);
      setCanvaNotice("Export PNG in corso...");

      const start = await createCanvaExport(canvaDesign.id, "png");
      const exportId = start?.job?.id;

      if (!exportId) {
        throw new Error("Export Canva non avviato");
      }

      const result = await pollCanvaExport(exportId, {
        intervalMs: 2000,
        maxAttempts: 30,
      });

      const downloadUrl =
        result?.job?.urls?.[0] ||
        result?.job?.download_url ||
        result?.job?.result?.url;

      setCanvaNotice("Export PNG pronto.");

      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      }
    } catch (error) {
      console.error(error);
      setCanvaNotice(error?.message || "Errore export Canva");
    } finally {
      setCanvaBusy(false);
    }
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
    };

    const updates = extractProfileUpdates(userText);
    const updatedProfile = applyProfileUpdates(profile, updates);

    if (JSON.stringify(updatedProfile) !== JSON.stringify(profile)) {
      setProfile(updatedProfile);
    }

    patchConversation(conversationId, (conv) => {
      const userMessagesCount = conv.messages.filter(
        (msg) => msg.sender === "user"
      ).length;

      const shouldRename =
        conv.title === "Nuova chat" || userMessagesCount === 0;

      return {
        ...conv,
        title: shouldRename ? getConversationTitle(userText) : conv.title,
        messages: [...conv.messages, userMessage],
        updatedAt: Date.now(),
      };
    });

    setInput("");
    setIsLoading(true);
    setStatusText("Zeus sta scrivendo...");

    try {
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
      });

      setStatusText("Connessione a Zeus non riuscita");
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
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-top">
          <div className="brand">
            <ZeusLogo />
            <div className="brand-copy">
              <div className="brand-title">Zeus</div>
              <div className="brand-subtitle">AI personale</div>
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
          onClick={createNewChat}
        >
          + Nuova chat
        </button>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Stato</div>
          <div className="status-pill">{statusLabel}</div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Creatore</div>
          <div className="creator-box">
            {creatorName || "Non ancora memorizzato"}
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Canva</div>

          <div className="canva-status-row">
            <span
              className={`canva-dot ${
                canvaStatus.connected ? "connected" : "disconnected"
              }`}
            ></span>
            <span className="canva-status-text">
              {canvaStatus.connected ? "Canva collegato" : "Canva non collegato"}
            </span>
          </div>

          {canvaDesign && (
            <div className="canva-design-box">
              <div className="canva-design-title">
                {canvaDesign.title || "Ultimo design Canva"}
              </div>
              <div className="canva-design-id">ID: {canvaDesign.id}</div>
            </div>
          )}

          {canvaNotice && <div className="canva-note">{canvaNotice}</div>}

          <div className="canva-actions">
            {!canvaStatus.connected ? (
              <button
                type="button"
                className="canva-primary-button"
                onClick={startCanvaConnect}
                disabled={canvaBusy}
              >
                Collega Canva
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="canva-primary-button"
                  onClick={handleCreateInstagramDesign}
                  disabled={canvaBusy}
                >
                  {canvaBusy ? "Attendi..." : "Crea post IG"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenCanvaDesign}
                  disabled={canvaBusy || !canvaDesign?.urls?.edit_url}
                >
                  Apri ultimo design
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleExportLastDesign}
                  disabled={canvaBusy || !canvaDesign?.id}
                >
                  Esporta PNG
                </button>
              </>
            )}
          </div>
        </div>

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
                  onClick={() => setActiveConversationId(conversation.id)}
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
              {currentConversation?.title || "Zeus"}
            </div>
            <div className="topbar-subtitle">
              Chat personale con memoria, ricerca e fonti
            </div>
          </div>
        </header>

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
                    <div className="assistant-avatar">Z</div>
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
                      <div className="assistant-name">Zeus</div>

                      <div className="assistant-markdown">
                        <MarkdownMessage text={message.text} />
                      </div>

                      {message.grounded && (
                        <div className="web-badge">
                          Risposta verificata sul web
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
                  <div className="assistant-avatar">Z</div>
                </div>

                <div className="message-bubble assistant-bubble">
                  <div className="assistant-name">Zeus</div>
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
              placeholder="Scrivi un messaggio a Zeus..."
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
      </main>
    </div>
  );
}

export default App;