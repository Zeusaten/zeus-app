import crypto from "crypto";

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_API_BASE = "https://api.canva.com/rest/v1";

const pendingAuth = new Map();

/**
 * Demo/single-user storage.
 * Su Render non è persistente: se il servizio riparte, perdi il token.
 * Per partire va bene, poi lo spostiamo su DB o file sicuro.
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
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${credentials}`;
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

  app.get("/api/canva/connect/start", (req, res) => {
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
          `Canva OAuth error: ${error_description || error || "errore sconosciuto"}`
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

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}?canva=connected`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const message = encodeURIComponent(
        error?.message || "Errore callback Canva"
      );
      res.redirect(`${frontendUrl}?canva_error=${message}`);
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
      const { designId, format = "png" } = req.body || {};

      if (!designId) {
        return res.status(400).json({ error: "designId mancante" });
      }

      const payload = {
        design_id: designId,
        format: {
          type: format,
        },
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