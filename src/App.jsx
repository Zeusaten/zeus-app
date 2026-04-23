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

const DEFAULT_MESSAGES = [
  {
    sender: "zeus",
    text: "Ciao. Sono Zeus. Ti aiuto in italiano con idee, organizzazione, scrittura e ricerche online con fonti.",
    grounded: false,
    searchQueries: [],
    sources: [],
  },
];

const QUICK_PROMPTS = [
  "Chi ti ha creato?",
  "Come mi chiamo?",
  "Cerca online le ultime notizie su Gemini",
  "Scrivimi una mail professionale",
];

function ZeusLogo() {
  return (
    <div className="zeus-logo">
      <span>Z</span>
    </div>
  );
}

function getStatusMeta(statusText, isLoading) {
  const lower = statusText.toLowerCase();

  if (isLoading) {
    return {
      label: "Zeus sta scrivendo...",
      className: "top-status loading",
    };
  }

  if (lower.includes("pronto")) {
    return {
      label: "Zeus è pronto",
      className: "top-status ready",
    };
  }

  if (
    lower.includes("riattivando") ||
    lower.includes("risvegliando") ||
    lower.includes("lento") ||
    lower.includes("collegando")
  ) {
    return {
      label: "Zeus si sta risvegliando...",
      className: "top-status waking",
    };
  }

  if (lower.includes("connessione")) {
    return {
      label: "Connessione non riuscita",
      className: "top-status warning",
    };
  }

  return {
    label: statusText,
    className: "top-status waking",
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

function App() {
  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem("zeus_messages");

    if (savedMessages) {
      try {
        return JSON.parse(savedMessages);
      } catch {
        return DEFAULT_MESSAGES;
      }
    }

    return DEFAULT_MESSAGES;
  });

  const [profile, setProfile] = useState(() => {
    const savedProfile = localStorage.getItem("zeus_profile");

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

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const creatorName = useMemo(
    () => profile.creatorName || null,
    [profile.creatorName]
  );

  const statusMeta = useMemo(
    () => getStatusMeta(statusText, isLoading),
    [statusText, isLoading]
  );

  useEffect(() => {
    const initZeus = async () => {
      try {
        await loadZeusEngine(setStatusText);
        setStatusText("Zeus è pronto");
      } catch (error) {
        console.error(error);
        setStatusText("Zeus si sta riattivando...");

        setTimeout(async () => {
          try {
            await loadZeusEngine(setStatusText);
            setStatusText("Zeus è pronto");
          } catch (retryError) {
            console.error(retryError);
            setStatusText(
              "Server Zeus temporaneamente lento. Puoi comunque riprovare tra poco."
            );
          }
        }, 4000);
      }
    };

    initZeus();
  }, []);

  useEffect(() => {
    localStorage.setItem("zeus_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("zeus_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const newMessage = {
      sender: "user",
      text: userText,
    };

    const previousMessages = [...messages];
    const updates = extractProfileUpdates(userText);
    const updatedProfile = applyProfileUpdates(profile, updates);

    if (JSON.stringify(updatedProfile) !== JSON.stringify(profile)) {
      setProfile(updatedProfile);
    }

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);
    setStatusText("Zeus sta pensando...");

    try {
      const deterministicReply = getDeterministicReply(
        userText,
        updatedProfile,
        updates
      );

      if (deterministicReply) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "zeus",
            text: deterministicReply,
            grounded: false,
            searchQueries: [],
            sources: [],
          },
        ]);
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

      setMessages((prev) => [
        ...prev,
        {
          sender: "zeus",
          text: normalized.text,
          grounded: normalized.grounded,
          searchQueries: normalized.searchQueries,
          sources: normalized.sources,
        },
      ]);

      setStatusText("Zeus è pronto");
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "zeus",
          text:
            error?.message ||
            "Il server di Zeus non è raggiungibile in questo momento.",
          grounded: false,
          searchQueries: [],
          sources: [],
        },
      ]);

      setStatusText("Connessione al server non riuscita");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem("zeus_messages");
    setMessages(DEFAULT_MESSAGES);
  };

  const handleClearMemory = () => {
    localStorage.removeItem("zeus_profile");
    setProfile(DEFAULT_PROFILE);
  };

  const handleQuickPrompt = (prompt) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSend(e);
      }
    }
  };

  return (
    <div className="chatgpt-shell">
      <aside className={`left-panel ${sidebarOpen ? "open" : "closed"}`}>
        <div className="left-panel-header">
          <div className="brand-row">
            <ZeusLogo />
            <div>
              <div className="brand-title">Zeus</div>
              <div className="brand-subtitle">AI personale</div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? "Chiudi" : "Apri"}
          </button>
        </div>

        <div className="left-panel-content">
          <button type="button" className="new-chat-btn" onClick={handleClearChat}>
            + Nuova chat
          </button>

          <div className="side-block">
            <div className="side-label">Stato</div>
            <div className={statusMeta.className}>{statusMeta.label}</div>
          </div>

          <div className="side-block">
            <div className="side-label">Creatore</div>
            <div className="side-value">
              {creatorName || "Non ancora memorizzato"}
            </div>
          </div>

          <div className="side-block">
            <div className="side-label">Prompt rapidi</div>
            <div className="quick-list">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="quick-item"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="side-block">
            <div className="side-label">Memoria</div>
            <div className="side-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={handleClearMemory}
              >
                Reset memoria
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="conversation-shell">
        <header className="conversation-topbar">
          <button
            type="button"
            className="mobile-sidebar-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>

          <div className="conversation-title-wrap">
            <div className="conversation-title">Zeus</div>
            <div className="conversation-subtitle">
              Chat personale con memoria, web search e fonti
            </div>
          </div>
        </header>

        <section className="conversation-area">
          <div className="conversation-inner">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat-row ${
                  message.sender === "user" ? "user-row" : "assistant-row"
                }`}
              >
                {message.sender === "zeus" && (
                  <div className="assistant-avatar">Z</div>
                )}

                <div
                  className={`chat-message ${
                    message.sender === "user"
                      ? "user-message"
                      : "assistant-message"
                  }`}
                >
                  {message.sender === "zeus" ? (
                    <>
                      <div className="assistant-name">Zeus</div>
                      <div className="markdown-body">
                        <MarkdownMessage text={message.text} />
                      </div>

                      {message.grounded && (
                        <div className="message-badge">
                          Risposta verificata sul web
                        </div>
                      )}

                      {message.sources?.length > 0 && (
                        <div className="message-sources">
                          <div className="message-sources-title">Fonti</div>
                          {message.sources.map((source, sourceIndex) => (
                            <a
                              key={`${source.url}-${sourceIndex}`}
                              className="message-source-link"
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title || source.url}
                            </a>
                          ))}
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
              <div className="chat-row assistant-row">
                <div className="assistant-avatar">Z</div>
                <div className="chat-message assistant-message">
                  <div className="assistant-name">Zeus</div>
                  <div className="streaming-loader">
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

        <footer className="composer-shell">
          <form className="composer-box" onSubmit={handleSend}>
            <textarea
              ref={textareaRef}
              placeholder="Scrivi un messaggio a Zeus..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="composer-actions">
              <div className="composer-hint">Invio per inviare · Shift+Invio per andare a capo</div>
              <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
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