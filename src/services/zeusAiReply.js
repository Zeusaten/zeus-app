const API_BASE = "http://localhost:3001";

export async function loadZeusEngine(setStatusText) {
  if (setStatusText) {
    setStatusText("Connessione al cervello di Zeus...");
  }

  const response = await fetch(`${API_BASE}/api/health`);

  if (!response.ok) {
    throw new Error("Server Zeus non raggiungibile");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error("Server Zeus non pronto");
  }

  if (setStatusText) {
    setStatusText("Zeus è pronto");
  }

  return data;
}

export async function getZeusAiReply(
  userText,
  messages,
  profile,
  setStatusText
) {
  if (setStatusText) {
    setStatusText("Zeus sta pensando...");
  }

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userText,
      messages,
      profile,
    }),
  });

  if (!response.ok) {
    let errorText = "Errore del server Zeus";

    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch {
    }

    throw new Error(errorText);
  }

  const data = await response.json();
  return data.reply;
}