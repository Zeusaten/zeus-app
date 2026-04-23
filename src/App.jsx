import { useEffect, useMemo, useRef, useState } from "react";
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

const STORAGE_CONVERSATIONS = "zeus_conversations";
const STORAGE_ACTIVE_CONVERSATION = "zeus_active_conversation";
const STORAGE_PROFILE = "zeus_profile";

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

function App() {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CONVERSATIONS);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
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
    const initZeus = async () => {
      try {
        await loadZeusEngine(setStatusText);
        setStatusText("Zeus è pronto");
      } catch (error) {
        console.error(error);
        setStatusText("Server Zeus temporaneamente lento. Puoi riprovare tra poco.");
      }
    };

    initZeus();
  }, []);

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
      const shouldRename =
        conv.title === "Nuova chat" ||
        conv.messages.filter((msg) => msg.sender === "user").length === 0;

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

        <button className="new-chat-button" type="button" onClick={createNewChat}>
          + Nuova chat
        </button>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Stato</div>
          <div className="status-pill">{statusText}</div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-label">Creatore</div>
          <div className="creator-box">
            {creatorName || "Non ancora memorizzato"}
          </div>
        </div>

        <div className="sidebar-card grow">
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

        <div className="sidebar-card">
          <div className="sidebar-card-label">Memoria</div>
          <button className="secondary-button" type="button" onClick={resetMemory}>
            Reset memoria
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