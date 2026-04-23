const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").trim() ||
  "https://zeus-server-yqpk.onrender.com";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Errore Canva");
  }

  return data;
}

export async function getCanvaStatus() {
  return request("/api/canva/status", {
    method: "GET",
  });
}

export function startCanvaConnect(onDone) {
  const popup = window.open(
    `${API_BASE}/api/canva/connect/start`,
    "canva-connect",
    "width=720,height=820,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes"
  );

  if (!popup) {
    throw new Error("Popup bloccato dal browser. Consenti i popup e riprova.");
  }

  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      if (typeof onDone === "function") {
        onDone();
      }
    }
  }, 700);

  return popup;
}

export async function createCanvaDesign({
  title = "Design Zeus",
  width = 1080,
  height = 1350,
} = {}) {
  return request("/api/canva/designs/create", {
    method: "POST",
    body: JSON.stringify({
      title,
      width,
      height,
    }),
  });
}

export async function createCanvaExport({
  designId,
  formatType,
  options = {},
}) {
  return request("/api/canva/exports/create", {
    method: "POST",
    body: JSON.stringify({
      designId,
      formatType,
      options,
    }),
  });
}

export async function getCanvaExport(exportId) {
  return request(`/api/canva/exports/${exportId}`, {
    method: "GET",
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollCanvaExport(
  exportId,
  { intervalMs = 2000, maxAttempts = 30 } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await getCanvaExport(exportId);
    const status = data?.job?.status;

    if (status === "success") {
      return data;
    }

    if (status === "failed") {
      throw new Error(
        data?.job?.error?.message || "Export Canva fallito"
      );
    }

    await sleep(intervalMs);
  }

  throw new Error("Timeout export Canva");
}