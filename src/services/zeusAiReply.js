const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").trim() ||
  "https://zeus-server-yqpk.onrender.com";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url,
  options = {},
  retries = 8,
  timeoutMs = 45000
) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      const waitMs = 2500 * (attempt + 1);
      await sleep(waitMs);
    }
  }

  throw lastError;
}

export async function loadZeusEngine(setStatusText) {
  if (setStatusText) {
    setStatusText("Sto collegando Zeus al server...");
  }

  const response = await fetchWithRetry(`${API_BASE}/api/health`, {}, 8, 45000);

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

  const response = await fetchWithRetry(
    `${API_BASE}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userText,
        messages,
        profile,
      }),
    },
    5,
    60000
  );

  if (!response.ok) {
    let errorText = "Il server di Zeus non è raggiungibile in questo momento.";

    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch {
      // ignore
    }

    throw new Error(errorText);
  }

  const data = await response.json();

  return {
    reply: data.reply || "Non sono riuscito a generare una risposta valida.",
    grounded: Boolean(data.grounded),
    searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

export async function getCatalogAiReply({
  userText,
  products = [],
  catalogName = "catalogo",
  assistantName = "Ted",
  setStatusText,
}) {
  if (setStatusText) {
    setStatusText(`${assistantName} sta ragionando sul catalogo...`);
  }

  const response = await fetchWithRetry(
    `${API_BASE}/api/catalog/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userText,
        products: Array.isArray(products) ? products.slice(0, 40) : [],
        catalogName,
        assistantName,
      }),
    },
    4,
    60000
  );

  if (!response.ok) {
    let errorText = `Il cervello catalogo di ${assistantName} non è raggiungibile in questo momento.`;

    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch {
      // ignore
    }

    throw new Error(errorText);
  }

  const data = await response.json();

  return {
    reply: data.reply || "Non sono riuscito a generare una risposta valida sul catalogo.",
    grounded: false,
    searchQueries: [],
    sources: [],
  };
}
