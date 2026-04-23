import crypto from "crypto";

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_API_BASE = "https://api.canva.com/rest/v1";

const pendingAuth = new Map();

/**
 * Demo storage in memoria.
 * Su Render free può perdersi dopo riavvii/sleep.
 */
let canvaSession = {
  tokens: null,
};

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Manca la variabile ambiente ${name}`);
  }
  return value;
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const codeVerifier = base64UrlEncode(crypto.randomBytes(64));
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

function createState() {
  return base64UrlEncode(crypto.randomBytes(32));
}

function getBasicAuthHeader() {
  const clientId = getRequiredEnv("CANVA_CLIENT_ID");
  const clientSecret = getRequiredEnv("CANVA_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );
  return `Basic ${credentials}`;
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function normalizePages(pages) {
  if (!Array.isArray(pages)) return undefined;

  const normalized = pages
    .map((page) => Number(page))
    .filter((page) => Number.isInteger(page) && page > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function buildExportFormat(formatType, rawOptions = {}) {
  const type = String(formatType || "").trim();

  if (!type) {
    throw new Error("formatType mancante");
  }

  const pages = normalizePages(rawOptions.pages);
  const exportQuality =
    rawOptions.exportQuality === "pro" ? "pro" : "regular";

  switch (type) {
    case "pdf": {
      const format = {
        type: "pdf",
        export_quality: exportQuality,
      };

      if (["a4", "a3", "letter", "legal"].includes(rawOptions.size)) {
        format.size = rawOptions.size;
      }

      if (pages) {
        format.pages = pages;
      }

      return format;
    }

    case "jpg": {
      const format = {
        type: "jpg",
        quality: Math.min(
          100,
          Math.max(1, Number(rawOptions.quality || 90))
        ),
        export_quality: exportQuality,
      };

      const width = toPositiveInt(rawOptions.width);
      const height = toPositiveInt(rawOptions.height);

      if (width) format.width = width;
      if (height) format.height = height;
      if (pages) format.pages = pages;

      return format;
    }

    case "png": {
      const format = {
        type: "png",
        export_quality: exportQuality,
        lossless:
          typeof rawOptions.lossless === "boolean"
            ? rawOptions.lossless
            : true,
        transparent_background: Boolean(rawOptions.transparentBackground),
        as_single_image: Boolean(rawOptions.asSingleImage),
      };

      const width = toPositiveInt(rawOptions.width);
      const height = toPositiveInt(rawOptions.height);

      if (width) format.width = width;
      if (height) format.height = height;
      if (pages) format.pages = pages;

      return format;
    }

    case "gif": {
      const format = {
        type: "gif",
        export_quality: exportQuality,
      };

      const width = toPositiveInt(rawOptions.width);
      const height = toPositiveInt(rawOptions.height);

      if (width) format.width = width;
      if (height) format.height = height;
      if (pages) format.pages = pages;

      return format;
    }

    case "pptx": {
      const format = {
        type: "pptx",
      };

      if (pages) {
        format.pages = pages;
      }

      return format;
    }

    case "mp4": {
      const allowedMp4Qualities = [
        "horizontal_480p",
        "horizontal_720p",
        "horizontal_1080p",
        "horizontal_4k",
        "vertical_480p",
        "vertical_720p",
        "vertical_1080p",
        "vertical_4k",
      ];

      const format = {
        type: "mp4",
        quality: allowedMp4Qualities.includes(rawOptions.quality)
          ? rawOptions.quality
          : "horizontal_1080p",
        export_quality: exportQuality,
      };

      if (pages) {
        format.pages = pages;
      }

      return format;
    }

    case "html_bundle": {
      const format = {
        type: "html_bundle",
      };

      if (pages?.length) {
        format.pages = [pages[0]];
      }

      return format;
    }

    case "html_standalone": {
      const format = {
        type: "html_standalone",
      };

      if (pages?.length) {
        format.pages = [pages[0]];
      }

      return format;
    }

    default:
      throw new Error(`Formato Canva non supportato: ${type}`);
  }
}

async function exchangeAuthorizationCode({ code, codeVerifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Canva token exchange fallito: ${data?.message || JSON.stringify(data)}`
    );
  }

  return {
    ...data,
    expires_at: Date.now() + (data.expires_in || 0) * 1000,
  };
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Canva refresh token fallito: ${data?.message || JSON.stringify(data)}`
    );
  }

  return {
    ...data,
    expires_at: Date.now() + (data.expires_in || 0) * 1000,
  };
}

async function getValidAccessToken() {
  if (!canvaSession.tokens?.access_token) {
    throw new Error("Canva non collegato");
  }

  const expiresAt = canvaSession.tokens.expires_at || 0;
  const needsRefresh = Date.now() > expiresAt - 60_000;

  if (!needsRefresh) {
    return canvaSession.tokens.access_token;
  }

  if (!canvaSession.tokens.refresh_token) {
    throw new Error("Refresh token Canva mancante");
  }

  const refreshed = await refreshAccessToken(canvaSession.tokens.refresh_token);
  canvaSession.tokens = refreshed;
  return refreshed.access_token;
}

async function canvaFetch(path, options = {}) {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Canva API error su ${path}: ${data?.message || JSON.stringify(data)}`
    );
  }

  return data;
}

export function registerCanvaRoutes(app) {
  app.get("/api/canva/status", (_req, res) => {
    res.json({
      connected: Boolean(canvaSession.tokens?.access_token),
      expiresAt: canvaSession.tokens?.expires_at || null,
      scopes: canvaSession.tokens?.scope || null,
    });
  });

  app.get("/api/canva/connect/start", (_req, res) => {
    try {
      const clientId = getRequiredEnv("CANVA_CLIENT_ID");
      const redirectUri = getRequiredEnv("CANVA_REDIRECT_URI");
      const scopes =
        process.env.CANVA_SCOPES ||
        "design:content:read design:content:write profile:read";

      const { codeVerifier, codeChallenge } = createPkcePair();
      const state = createState();

      pendingAuth.set(state, {
        codeVerifier,
        createdAt: Date.now(),
      });

      const params = new URLSearchParams({
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        scope: scopes,
        response_type: "code",
        client_id: clientId,
        state,
        redirect_uri: redirectUri,
      });

      res.redirect(`${CANVA_AUTH_URL}?${params.toString()}`);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Errore avvio collegamento Canva",
      });
    }
  });

  app.get("/api/canva/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        throw new Error(
          `Canva OAuth error: ${
            error_description || error || "errore sconosciuto"
          }`
        );
      }

      if (!code || !state) {
        throw new Error("Code o state mancanti nel callback Canva");
      }

      const saved = pendingAuth.get(state);

      if (!saved) {
        throw new Error("State Canva non valido o scaduto");
      }

      pendingAuth.delete(state);

      const redirectUri = getRequiredEnv("CANVA_REDIRECT_URI");

      const tokens = await exchangeAuthorizationCode({
        code: String(code),
        codeVerifier: saved.codeVerifier,
        redirectUri,
      });

      canvaSession.tokens = tokens;

      res.send(`
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>Canva collegato</title>
    <style>
      body {
        font-family: Inter, Arial, sans-serif;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        background: #f7f9ff;
        color: #1a223b;
      }
      .box {
        padding: 24px 28px;
        border-radius: 18px;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>Canva collegato</h2>
      <p>Puoi tornare a Zeus. Questa finestra si chiuderà da sola.</p>
    </div>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type: "CANVA_CONNECTED" }, "*");
        }
      } catch (e) {}
      setTimeout(() => window.close(), 700);
    </script>
  </body>
</html>
      `);
    } catch (error) {
      const safeMessage = String(
        error?.message || "Errore callback Canva"
      )
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      res.status(500).send(`
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>Errore Canva</title>
    <style>
      body {
        font-family: Inter, Arial, sans-serif;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        background: #fff8f8;
        color: #7a1f1f;
      }
      .box {
        padding: 24px 28px;
        border-radius: 18px;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        text-align: center;
        max-width: 520px;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>Errore collegamento Canva</h2>
      <p>${safeMessage}</p>
    </div>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(
            { type: "CANVA_ERROR", message: ${JSON.stringify(safeMessage)} },
            "*"
          );
        }
      } catch (e) {}
    </script>
  </body>
</html>
      `);
    }
  });

  app.post("/api/canva/designs/create", async (req, res) => {
    try {
      const {
        title = "Creato con Zeus",
        presetName = "presentation",
        width,
        height,
      } = req.body || {};

      let payload;

      if (width && height) {
        payload = {
          design_type: {
            type: "custom",
            width: Number(width),
            height: Number(height),
          },
          title,
        };
      } else {
        payload = {
          design_type: {
            type: "preset",
            name: presetName,
          },
          title,
        };
      }

      const data = await canvaFetch("/designs", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Errore creazione design Canva",
      });
    }
  });

  app.post("/api/canva/exports/create", async (req, res) => {
    try {
      const { designId, formatType, options = {} } = req.body || {};

      if (!designId) {
        return res.status(400).json({ error: "designId mancante" });
      }

      if (!formatType) {
        return res.status(400).json({ error: "formatType mancante" });
      }

      const payload = {
        design_id: designId,
        format: buildExportFormat(formatType, options),
      };

      const data = await canvaFetch("/exports", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Errore avvio export Canva",
      });
    }
  });

  app.get("/api/canva/exports/:exportId", async (req, res) => {
    try {
      const { exportId } = req.params;

      const data = await canvaFetch(`/exports/${exportId}`, {
        method: "GET",
        headers: {},
      });

      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Errore lettura export Canva",
      });
    }
  });
}