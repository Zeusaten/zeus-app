import { useEffect, useMemo, useRef, useState } from "react";
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
    text: "Ciao. Sono Zeus. Ti aiuto in italiano con idee, organizzazione e prompt.",
  },
];

const QUICK_PROMPTS = [
  "Chi ti ha creato?",
  "Come mi chiamo?",
  "Aiutami a organizzare una giornata produttiva",
  "Scrivimi un prompt per un'immagine cinematografica",
];

function ZeusAvatar() {
  return (
    <div className="zeus-avatar">
      <div className="zeus-avatar-ring"></div>
      <svg
        viewBox="0 0 120 120"
        className="zeus-avatar-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="zeusGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#89a6ff" />
            <stop offset="55%" stopColor="#6f6cff" />
            <stop offset="100%" stopColor="#b376ff" />
          </linearGradient>
        </defs>

        <circle cx="60" cy="60" r="52" fill="rgba(255,255,255,0.96)" />
        <path
          d="M64 20L40 61h18l-6 39 28-45H62l2-35z"
          fill="url(#zeusGlow)"
        />
      </svg>
    </div>
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

  const messagesEndRef = useRef(null);

  const creatorName = useMemo(
    () => profile.creatorName || null,
    [profile.creatorName]
  );

  const lastNote = useMemo(() => {
    if (!profile.notes.length) return null;
    return profile.notes[profile.notes.length - 1];
  }, [profile.notes]);

  useEffect(() => {
    const initZeus = async () => {
      try {
        await loadZeusEngine(setStatusText);
        setStatusText("Zeus è pronto");
      } catch (error) {
        console.error(error);
        setStatusText(`Errore: ${error?.message || "sconosciuto"}`);

        const errorReply = {
          sender: "zeus",
          text: `Errore reale: ${error?.message || "sconosciuto"}`,
        };

        setMessages((prev) => [...prev, errorReply]);
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
          { sender: "zeus", text: deterministicReply },
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

      setMessages((prev) => [...prev, { sender: "zeus", text: aiReply }]);
      setStatusText("Zeus è pronto");
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "zeus",
          text: `Errore reale: ${error?.message || "sconosciuto"}`,
        },
      ]);

      setStatusText(`Errore: ${error?.message || "sconosciuto"}`);
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
  };

  return (
    <div className="page-shell">
      <div className="premium-orb orb-a"></div>
      <div className="premium-orb orb-b"></div>
      <div className="premium-grid"></div>

      <div className="layout-shell">
        <aside className="sidebar">
          <div className="sidebar-card sidebar-top">
            <ZeusAvatar />

            <div className="sidebar-brand">
              <span className="eyebrow">AI PERSONAL CORE</span>
              <h1>Zeus</h1>
              <p>
                Interfaccia conversazionale personale, luminosa, precisa e
                futuristica.
              </p>
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-label">Stato sistema</div>
            <div className="status-pill">{statusText}</div>
          </div>

          <div className="sidebar-card">
            <div className="card-label">Creatore riconosciuto</div>
            <div className="creator-box">
              {creatorName || "Non ancora memorizzato"}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-label">Profilo Zeus</div>
            <div className="memory-stats">
              <div className="memory-stat">
                <span className="memory-number">{profile.notes.length}</span>
                <span className="memory-text">note salvate</span>
              </div>
              <div className="memory-stat">
                <span className="memory-number">{messages.length}</span>
                <span className="memory-text">messaggi totali</span>
              </div>
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-label">Ultimo ricordo</div>
            <div className="creator-box">
              {lastNote || "Nessun ricordo disponibile"}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-label">Azioni rapide</div>
            <div className="sidebar-actions">
              <button
                type="button"
                className="sidebar-button"
                onClick={handleClearChat}
              >
                Nuova chat
              </button>
              <button
                type="button"
                className="sidebar-button sidebar-button-secondary"
                onClick={handleClearMemory}
              >
                Reset memoria
              </button>
            </div>
          </div>
        </aside>

        <main className="main-panel">
          <section className="hero-panel">
            <span className="hero-badge">Zeus Interface</span>
            <h2>Un sistema conversazionale premium, chiaro e progettato per il futuro.</h2>
            <p>
              Zeus usa memoria strutturata, risposte certe sulle informazioni
              importanti e il modello solo quando serve davvero.
            </p>

            <div className="quick-prompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="prompt-chip"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className="chat-panel">
            <div className="chat-header">
              <div>
                <div className="chat-title">Conversazione</div>
                <div className="chat-subtitle">
                  Chat personale con memoria strutturata e logica ibrida
                </div>
              </div>
            </div>

            <div className="messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-row ${
                    message.sender === "zeus" ? "left" : "right"
                  }`}
                >
                  <div className={`message ${message.sender}`}>
                    <strong>{message.sender === "zeus" ? "Zeus" : "Tu"}</strong>
                    <p>{message.text}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message-row left">
                  <div className="message zeus">
                    <strong>Zeus</strong>
                    <div className="typing-loader">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef}></div>
            </div>

            <form className="input-area" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Scrivi un messaggio a Zeus..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit">Invia</button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;