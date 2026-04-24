import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { registerCanvaRoutes } from "./canva.mjs";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const model = process.env.ZEUS_MODEL || "gemini-2.5-flash";
const fallbackModel = process.env.ZEUS_FALLBACK_MODEL || "";

if (!process.env.GEMINI_API_KEY) {
  console.error("Manca GEMINI_API_KEY nel file .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorText(error) {
  return String(
    error?.message ||
      error?.error?.message ||
      JSON.stringify(error || "")
  ).toLowerCase();
}

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.code ||
    error?.error?.code ||
    null
  );
}

function isQuotaExceededError(error) {
  const message = getErrorText(error);
  const status = getErrorStatus(error);

  return (
    status === 429 ||
    status === "429" ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("rate limit")
  );
}

function isRetryableGeminiError(error) {
  const message = getErrorText(error);
  const status = getErrorStatus(error);

  return (
    status === 503 ||
    status === "503" ||
    message.includes('"code":503') ||
    message.includes('"status":"unavailable"') ||
    message.includes("high demand") ||
    message.includes("unavailable") ||
    message.includes("temporarily unavailable")
  );
}

function shouldFallbackWithoutSearch(error) {
  const message = getErrorText(error);
  const status = getErrorStatus(error);

  return (
    status === 400 ||
    status === "400" ||
    message.includes("invalid argument") ||
    message.includes("unsupported") ||
    message.includes("google search") ||
    message.includes("google_search") ||
    message.includes("tool") ||
    message.includes("grounding")
  );
}

function buildResponseStyle(profile = {}) {
  const preferences = profile.preferences || {};
  const responseLength = preferences.responseLength || "breve";
  const tone = preferences.tone || "diretto";
  const writingStyle = preferences.writingStyle || "professionale";
  const promptStyle = preferences.promptStyle || "cinematico";

  let lengthInstruction = "Tieni le risposte brevi, ma complete.";
  if (responseLength === "dettagliata") {
    lengthInstruction =
      "Puoi fare risposte più dettagliate, ma sempre ordinate e complete.";
  }

  let toneInstruction = "Usa un tono diretto e naturale.";
  if (tone === "professionale") {
    toneInstruction = "Usa un tono professionale, chiaro e pulito.";
  }
  if (tone === "creativo") {
    toneInstruction = "Usa un tono creativo ma leggibile.";
  }
  if (tone === "tecnico") {
    toneInstruction = "Usa un tono tecnico ma comprensibile.";
  }

  return {
    responseLength,
    tone,
    writingStyle,
    promptStyle,
    lengthInstruction,
    toneInstruction,
  };
}

function buildSystemPrompt(profile = {}) {
  const creatorName = profile.creatorName || "";
  const creatorRole = profile.creatorRole || "creatore";
  const birthDate = profile.birthDate || "";
  const identity = profile.identity || "assistente AI personale";
  const isHuman = profile.isHuman ? "sì" : "no";
  const language = profile.language || "italiano";
  const notes = Array.isArray(profile.notes) ? profile.notes : [];
  const style = buildResponseStyle(profile);

  const notesText =
    notes.length > 0
      ? notes.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "Nessuna nota salvata.";

  return `
Ti chiami Zeus.
Sei un assistente AI personale.
Non sei un essere umano.
Non dire mai di essere umano, di essere nato in un'università o cose simili.
Il tuo creatore è l'utente che ti parla in questa app.
Se conosci il nome del creatore, usalo correttamente.

Rispondi sempre e solo in italiano corretto.
Comprendi bene ciò che l'utente dice prima di rispondere.
Non inventare fatti.
Se non sei sicuro, dillo chiaramente.
Evita risposte vaghe o confuse.

Quando l'utente fa domande attuali, verificabili, recenti, o che richiedono fonti, prova a usare la ricerca web se disponibile.
Se la ricerca web non è disponibile, rispondi comunque nel miglior modo possibile senza bloccarti.
Se l'utente chiede di riscrivere, rimandare o rifare un testo, restituisci il testo completo.
Non interrompere mai la risposta a metà.
Non lasciare parole tagliate.
Se stai per finire lo spazio, completa prima l'ultima frase in modo pulito.

Stile di risposta richiesto:
- lunghezza: ${style.responseLength}
- tono: ${style.tone}
- stile scrittura: ${style.writingStyle}
- stile prompt: ${style.promptStyle}
- istruzione lunghezza: ${style.lengthInstruction}
- istruzione tono: ${style.toneInstruction}

Profilo strutturato:
- creatorName: ${creatorName || "sconosciuto"}
- creatorRole: ${creatorRole}
- birthDate: ${birthDate || "non definita"}
- identity: ${identity}
- isHuman: ${isHuman}
- language: ${language}

Note salvate:
${notesText}
`;
}

function getResponseText(response) {
  if (response?.text) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function getFinishReason(response) {
  return response?.candidates?.[0]?.finishReason || "";
}

function endsCleanly(text) {
  if (!text) return false;

  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  const lastChar = trimmed.slice(-1);
  const cleanEndChars = [".", "!", "?", "”", "\"", "»", ":", ";"];

  if (!cleanEndChars.includes(lastChar)) {
    return false;
  }

  const badEndings = [
    " e.",
    " di.",
    " che.",
    " per.",
    " con.",
    " il.",
    " la.",
    " lo.",
    " un.",
    " una.",
    " ma.",
    " se.",
    " o.",
    " ed.",
    " al.",
    " del.",
    " nel.",
  ];

  const lower = trimmed.toLowerCase();
  return !badEndings.some((ending) => lower.endsWith(ending));
}

function sanitizeFinalText(text) {
  if (!text) return "Non sono riuscito a generare una risposta valida.";

  let cleaned = text.replace(/\s+/g, " ").trim();

  if (!endsCleanly(cleaned)) {
    const lastSentenceMatch = cleaned.match(/^(.*[.!?]["»”']?)\s+[^.!?]*$/);
    if (lastSentenceMatch && lastSentenceMatch[1]) {
      cleaned = lastSentenceMatch[1].trim();
    }
  }

  return cleaned;
}

function isRewriteIntent(lower) {
  return (
    lower.includes("rimandamela") ||
    lower.includes("rimandamelo") ||
    lower.includes("rimandalo") ||
    lower.includes("rimandami il testo") ||
    lower.includes("riscrivimela") ||
    lower.includes("rifammi il testo") ||
    lower.includes("rimandamela completa")
  );
}

function isWritingRequest(lower) {
  return (
    lower.includes("scrivimi") ||
    lower.includes("preparami") ||
    lower.includes("fammi un testo") ||
    lower.includes("email") ||
    lower.includes("bozza") ||
    lower.includes("proposta") ||
    lower.includes("messaggio")
  );
}

function isPromptRequest(lower) {
  return (
    lower.includes("prompt") &&
    (lower.includes("immagine") ||
      lower.includes("immagini") ||
      lower.includes("video"))
  );
}

function buildTaskInstruction(userText, recentMessages) {
  const lower = userText.toLowerCase();

  if (isRewriteIntent(lower)) {
    const lastAssistantText =
      [...recentMessages]
        .reverse()
        .find((msg) => msg.sender === "zeus" && msg.text.length > 30)?.text || "";

    return `
Richiesta speciale:
L'utente vuole che tu rimandi integralmente il testo o la bozza discussa poco fa.
Devi restituire il testo completo, già pronto da copiare.
Non commentarlo.
Non introdurlo con spiegazioni inutili.
${lastAssistantText ? `Ultimo testo utile di riferimento:\n${lastAssistantText}` : ""}
`;
  }

  if (isWritingRequest(lower)) {
    return `
Richiesta speciale:
L'utente vuole un testo pronto da usare.
Se sta chiedendo una proposta, email, bozza o messaggio, restituisci direttamente il testo finale completo e ben scritto.
`;
  }

  if (isPromptRequest(lower)) {
    return `
Richiesta speciale:
Se l'utente chiede un prompt per immagini o video, rispondi così:
1. una breve spiegazione in italiano
2. poi un prompt finale pronto da copiare
`;
  }

  return "";
}

function extractGrounding(response) {
  const metadata = response?.candidates?.[0]?.groundingMetadata || {};
  const rawChunks = Array.isArray(metadata.groundingChunks)
    ? metadata.groundingChunks
    : [];
  const rawQueries = Array.isArray(metadata.webSearchQueries)
    ? metadata.webSearchQueries
    : [];

  const unique = new Map();

  for (const chunk of rawChunks) {
    const web = chunk?.web;
    if (!web || !web.uri) continue;

    if (!unique.has(web.uri)) {
      unique.set(web.uri, {
        title: web.title || web.uri,
        url: web.uri,
      });
    }
  }

  return {
    grounded: rawQueries.length > 0 || unique.size > 0,
    searchQueries: rawQueries,
    sources: Array.from(unique.values()),
  };
}

async function generateGeminiResponse(
  currentModel,
  prompt,
  maxOutputTokens,
  useSearch
) {
  return ai.models.generateContent({
    model: currentModel,
    contents: prompt,
    config: {
      temperature: 0.25,
      maxOutputTokens,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
}

async function callGeminiWithRetry(prompt, maxOutputTokens = 1200) {
  const modelsToTry = [model, fallbackModel].filter(Boolean);
  let lastError = null;

  for (const currentModel of modelsToTry) {
    let mustRetryWithoutSearch = false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await generateGeminiResponse(
          currentModel,
          prompt,
          maxOutputTokens,
          true
        );
      } catch (error) {
        lastError = error;

        if (isQuotaExceededError(error)) {
          console.warn(
            `Quota esaurita sul modello ${currentModel}, provo il modello successivo se disponibile.`
          );
          mustRetryWithoutSearch = false;
          break;
        }

        if (shouldFallbackWithoutSearch(error)) {
          console.warn(
            `Ricerca web non disponibile sul modello ${currentModel}, provo senza ricerca.`
          );
          mustRetryWithoutSearch = true;
          break;
        }

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        const waitMs = 3000 * (attempt + 1);
        console.warn(
          `Modello ${currentModel} occupato con ricerca web, tentativo ${attempt + 1}/4. Attendo ${waitMs}ms`
        );
        await sleep(waitMs);
      }
    }

    if (mustRetryWithoutSearch) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          return await generateGeminiResponse(
            currentModel,
            prompt,
            maxOutputTokens,
            false
          );
        } catch (error) {
          lastError = error;

          if (isQuotaExceededError(error)) {
            console.warn(
              `Quota esaurita sul modello ${currentModel} anche senza ricerca, provo il modello successivo se disponibile.`
            );
            break;
          }

          if (!isRetryableGeminiError(error)) {
            throw error;
          }

          const waitMs = 3000 * (attempt + 1);
          console.warn(
            `Modello ${currentModel} occupato senza ricerca, tentativo ${attempt + 1}/4. Attendo ${waitMs}ms`
          );
          await sleep(waitMs);
        }
      }
    }
  }

  throw lastError;
}

function mergeArraysUnique(a = [], b = []) {
  return [...new Set([...(a || []), ...(b || [])])];
}

function mergeSources(a = [], b = []) {
  const byUrl = new Map();

  for (const item of [...a, ...b]) {
    if (!item?.url) continue;
    if (!byUrl.has(item.url)) {
      byUrl.set(item.url, item);
    }
  }

  return Array.from(byUrl.values());
}

async function generateCompleteReply(prompt) {
  let response = await callGeminiWithRetry(prompt, 1200);
  let text = getResponseText(response);
  let finishReason = getFinishReason(response);

  let grounding = extractGrounding(response);
  let attempts = 0;
  const maxAttempts = 3;

  while (
    attempts < maxAttempts &&
    (!endsCleanly(text) || finishReason === "MAX_TOKENS")
  ) {
    const continuePrompt = `
Devi continuare una risposta che si è interrotta.

Regole:
- Continua esattamente da dove eri arrivato.
- Non ripetere l'inizio.
- Non salutare di nuovo.
- Non ricominciare da capo.
- Se l'ultima parola è tagliata, riparti dall'inizio di quella parola e completa bene la frase.
- Chiudi la risposta in modo completo e naturale.
- Non lasciare parole monche.
- Non terminare con frasi sospese.

Testo già scritto:
${text}

Continua adesso:
`;

    const continuationResponse = await callGeminiWithRetry(continuePrompt, 700);
    const continuation = getResponseText(continuationResponse);
    finishReason = getFinishReason(continuationResponse);

    if (!continuation) break;

    const continuationGrounding = extractGrounding(continuationResponse);

    grounding = {
      grounded: grounding.grounded || continuationGrounding.grounded,
      searchQueries: mergeArraysUnique(
        grounding.searchQueries,
        continuationGrounding.searchQueries
      ),
      sources: mergeSources(grounding.sources, continuationGrounding.sources),
    };

    text = `${text} ${continuation}`.replace(/\s+/g, " ").trim();
    attempts += 1;
  }

  return {
    reply: sanitizeFinalText(text),
    grounded: grounding.grounded,
    searchQueries: grounding.searchQueries,
    sources: grounding.sources,
  };
}


function compactCatalogProducts(products = [], maxItems = 12) {
  if (!Array.isArray(products)) return [];

  return products.slice(0, maxItems).map((product, index) => ({
    n: index + 1,
    name: product?.name || "",
    brand: product?.brand || "",
    category: product?.category || "",
    price: product?.price ?? null,
    old_price: product?.old_price ?? null,
    currency: product?.currency || "EUR",
    availability:
      String(product?.availability || "").toUpperCase() === "IN_STOCK"
        ? "disponibile"
        : String(product?.availability || "").toUpperCase() === "OUT_OF_STOCK"
          ? "non disponibile"
          : product?.availability || "",
    available_sizes: Array.isArray(product?.available_sizes)
      ? product.available_sizes.slice(0, 12)
      : [],
    url: product?.url || "",
  }));
}

async function callGeminiNoSearchWithRetry(prompt, maxOutputTokens = 900) {
  const modelsToTry = [model, fallbackModel].filter(Boolean);
  let lastError = null;

  for (const currentModel of modelsToTry) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await generateGeminiResponse(
          currentModel,
          prompt,
          maxOutputTokens,
          false
        );
      } catch (error) {
        lastError = error;

        if (isQuotaExceededError(error)) {
          console.warn(
            `Quota esaurita sul modello ${currentModel}, provo il modello successivo se disponibile.`
          );
          break;
        }

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        const waitMs = 2500 * (attempt + 1);
        console.warn(
          `Catalog brain: modello ${currentModel} occupato, tentativo ${attempt + 1}/4. Attendo ${waitMs}ms`
        );
        await sleep(waitMs);
      }
    }
  }

  throw lastError;
}

function buildCatalogBrainPrompt({
  assistantName = "Ted",
  catalogName = "catalogo",
  userText,
  products = [],
}) {
  const compactProducts = compactCatalogProducts(products, 40);

  return `
Ti chiami ${assistantName}.
Sei un assistente commerciale chiuso al catalogo ${catalogName}.

REGOLE NON NEGOZIABILI:
- Devi rispondere solo usando i prodotti forniti nella sezione PRODOTTI_CATALOGO.
- Non usare conoscenza esterna.
- Non usare il web.
- Non inventare prodotti, prezzi, disponibilità, formati o caratteristiche non presenti nei dati.
- Se i prodotti non bastano per rispondere bene, dillo chiaramente e chiedi un dettaglio utile.
- Se l'utente chiede consigli medici o sanitari, non fare diagnosi e non dare terapia: limitati a proporre prodotti pertinenti del catalogo e consiglia di chiedere a un professionista.
FORMATO OBBLIGATORIO:
- Rispondi in 3-5 righe, massimo 90 parole.
- Usa massimo 4 punti elenco totali, solo se servono davvero.
- NON elencare tutti i prodotti ricevuti.
- Se ci sono tanti prodotti, dai sempre un riepilogo per famiglie e cita solo 2-4 esempi concreti.
- Prima frase: risultato principale della ricerca, ma non fermarti a una sola frase se puoi dare un confronto utile.
- Se tutti i prodotti pertinenti sono non disponibili, scrivilo subito nella prima frase.
- Se l'utente chiede un confronto, confronta per tipo prodotto, prezzo e disponibilità, senza lista lunga.
- Cita i prodotti per nome esatto solo quando sono davvero utili.
- Non dire che hai cercato sul web.
- Non dire che hai fonti web.
- Non mostrare link grezzi: le card prodotto sono già sotto.
- Non scrivere codici tecnici come IN_STOCK o OUT_OF_STOCK. Usa solo "disponibile" o "non disponibile".
- Se serve più dettaglio, chiudi con: "Vuoi che ti mostri solo i disponibili o una fascia di prezzo precisa?"

PRODOTTI_CATALOGO_JSON:
${JSON.stringify(compactProducts, null, 2)}

DOMANDA_UTENTE:
${userText}

Rispondi ora come ${assistantName}, usando solo PRODOTTI_CATALOGO_JSON. Rispetta rigidamente il formato obbligatorio: 3-5 righe, massimo 90 parole, con un riepilogo utile.
`;
}

async function generateCatalogBrainReply(payload) {
  const prompt = buildCatalogBrainPrompt(payload);
  const response = await callGeminiNoSearchWithRetry(prompt, 450);
  const text = getResponseText(response);

  return {
    reply: sanitizeFinalText(text),
    grounded: false,
    searchQueries: [],
    sources: [],
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Zeus server online",
    health: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model, fallbackModel });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { userText, messages = [], profile = {} } = req.body;

    if (!userText || typeof userText !== "string") {
      return res.status(400).json({ error: "userText mancante o non valido" });
    }

    const recentMessages = Array.isArray(messages) ? messages.slice(-20) : [];

    const conversationText = recentMessages
      .map((message) => {
        const role = message.sender === "user" ? "Utente" : "Zeus";
        return `${role}: ${message.text}`;
      })
      .join("\n");

    const taskInstruction = buildTaskInstruction(userText, recentMessages);

    const prompt = `
${buildSystemPrompt(profile)}

${taskInstruction}

Cronologia recente:
${conversationText || "Nessuna cronologia."}

Messaggio attuale dell'utente:
${userText}

Rispondi ora come Zeus.
`;

    const result = await generateCompleteReply(prompt);

    res.json(result);
  } catch (error) {
    console.error("Errore /api/chat:", error);

    if (isQuotaExceededError(error)) {
      return res.status(429).json({
        error:
          "Hai raggiunto la quota disponibile di Gemini per questo modello. Riprova più tardi oppure usa un modello diverso.",
      });
    }

    if (isRetryableGeminiError(error)) {
      return res.status(503).json({
        error:
          "Zeus è momentaneamente sotto carico. Aspetta qualche secondo e riprova.",
      });
    }

    return res.status(500).json({
      error:
        "Si è verificato un errore temporaneo nel cervello di Zeus. Riprova tra poco.",
    });
  }
});

app.post("/api/catalog/chat", async (req, res) => {
  try {
    const {
      userText,
      products = [],
      catalogName = "catalogo",
      assistantName = "Ted",
    } = req.body || {};

    if (!userText || typeof userText !== "string") {
      return res.status(400).json({ error: "userText mancante o non valido" });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.json({
        reply:
          `Non ho trovato prodotti compatibili nel catalogo ${catalogName}. Prova a specificare meglio categoria, marca, prodotto, prezzo o disponibilità.`,
        grounded: false,
        searchQueries: [],
        sources: [],
      });
    }

    const result = await generateCatalogBrainReply({
      userText,
      products,
      catalogName,
      assistantName,
    });

    res.json(result);
  } catch (error) {
    console.error("Errore /api/catalog/chat:", error);

    if (isQuotaExceededError(error)) {
      return res.status(429).json({
        error:
          "Hai raggiunto la quota disponibile di Gemini per questo modello. Riprova più tardi.",
      });
    }

    if (isRetryableGeminiError(error)) {
      return res.status(503).json({
        error:
          "Il cervello catalogo è momentaneamente sotto carico. Riprova tra qualche secondo.",
      });
    }

    return res.status(500).json({
      error:
        "Errore temporaneo nel cervello catalogo. Riprova tra poco.",
    });
  }
});


registerCanvaRoutes(app);

app.listen(port, () => {
  console.log(`Zeus server attivo su http://localhost:${port}`);
  console.log(`Modello: ${model}`);
  console.log(`Fallback: ${fallbackModel || "nessuno"}`);
});