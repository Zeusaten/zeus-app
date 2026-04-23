export const DEFAULT_PROFILE = {
  creatorName: "",
  creatorRole: "creatore",
  birthDate: "",
  identity: "assistente AI personale",
  isHuman: false,
  language: "italiano",
  preferences: {
    responseLength: "breve",
    tone: "diretto",
    writingStyle: "professionale",
    promptStyle: "cinematico",
  },
  notes: ["Il mio creatore è l'utente che mi parla in questa chat."],
};

function normalizeText(text) {
  return text.trim().replace(/\s+/g, " ");
}

function cleanCapturedValue(value) {
  return value
    .trim()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

function addUniqueNote(notes, note) {
  if (!note) return notes;
  if (notes.includes(note)) return notes;
  return [...notes, note];
}

function hasSensitiveContent(lower) {
  return (
    lower.includes("api key") ||
    lower.includes("chiave api") ||
    lower.includes("password") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("segreto")
  );
}

function detectResponseLength(lower) {
  if (
    lower.includes("risposte brevi") ||
    lower.includes("risposte più brevi") ||
    lower.includes("risposte concise") ||
    lower.includes("sii conciso")
  ) {
    return "breve";
  }

  if (
    lower.includes("risposte dettagliate") ||
    lower.includes("risposte più dettagliate") ||
    lower.includes("risposte lunghe") ||
    lower.includes("spiega bene")
  ) {
    return "dettagliata";
  }

  return null;
}

function detectTone(lower) {
  if (
    lower.includes("tono diretto") ||
    lower.includes("parla in modo diretto") ||
    lower.includes("sii diretto")
  ) {
    return "diretto";
  }

  if (
    lower.includes("tono professionale") ||
    lower.includes("parla in modo professionale") ||
    lower.includes("sii professionale")
  ) {
    return "professionale";
  }

  if (
    lower.includes("tono creativo") ||
    lower.includes("parla in modo creativo") ||
    lower.includes("sii creativo")
  ) {
    return "creativo";
  }

  if (
    lower.includes("tono tecnico") ||
    lower.includes("parla in modo tecnico") ||
    lower.includes("sii tecnico")
  ) {
    return "tecnico";
  }

  return null;
}

function detectWritingStyle(lower) {
  if (
    lower.includes("quando scrivi email") ||
    lower.includes("quando scrivi testi") ||
    lower.includes("quando scrivi bozze") ||
    lower.includes("testi professionali")
  ) {
    return "professionale";
  }

  if (
    lower.includes("testi creativi") ||
    lower.includes("scrivi in modo creativo")
  ) {
    return "creativo";
  }

  return null;
}

function detectPromptStyle(lower) {
  if (
    lower.includes("prompt cinematografici") ||
    lower.includes("stile cinematografico") ||
    lower.includes("prompt cinematici")
  ) {
    return "cinematico";
  }

  if (
    lower.includes("prompt minimal") ||
    lower.includes("stile minimale") ||
    lower.includes("stile minimal")
  ) {
    return "minimal";
  }

  if (
    lower.includes("prompt realistici") ||
    lower.includes("stile realistico")
  ) {
    return "realistico";
  }

  return null;
}

export function extractProfileUpdates(userText) {
  const text = normalizeText(userText);
  const lower = text.toLowerCase();

  const updates = {
    creatorDeclared: false,
    creatorName: null,
    birthDate: null,
    notesToAdd: [],
    preferences: {},
    sensitiveCredential: false,
  };

  if (hasSensitiveContent(lower)) {
    updates.sensitiveCredential = true;
    return updates;
  }

  if (
    lower.includes("sono il tuo creatore") ||
    lower.includes("ti ho creato io") ||
    lower.includes("io ti ho creato")
  ) {
    updates.creatorDeclared = true;
  }

  const nameMatch =
    text.match(/mi chiamo\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]+)/i) ||
    text.match(/il mio nome è\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]+)/i);

  if (nameMatch) {
    updates.creatorName = cleanCapturedValue(nameMatch[1]);
  }

  const birthMatch =
    text.match(/(?:tu\s+)?sei nato(?: oggi)?\s+(.+)/i) ||
    text.match(/(?:tu\s+)?sei venuto alla luce(?: il)?\s+(.+)/i);

  if (birthMatch) {
    updates.birthDate = cleanCapturedValue(birthMatch[1]);
  }

  const responseLength = detectResponseLength(lower);
  if (responseLength) {
    updates.preferences.responseLength = responseLength;
  }

  const tone = detectTone(lower);
  if (tone) {
    updates.preferences.tone = tone;
  }

  const writingStyle = detectWritingStyle(lower);
  if (writingStyle) {
    updates.preferences.writingStyle = writingStyle;
  }

  const promptStyle = detectPromptStyle(lower);
  if (promptStyle) {
    updates.preferences.promptStyle = promptStyle;
  }

  if (lower.startsWith("ricordati che")) {
    const cleaned = cleanCapturedValue(text.replace(/ricordati che/i, ""));
    if (cleaned) updates.notesToAdd.push(cleaned);
  }

  if (lower.startsWith("ricorda che")) {
    const cleaned = cleanCapturedValue(text.replace(/ricorda che/i, ""));
    if (cleaned) updates.notesToAdd.push(cleaned);
  }

  if (lower.startsWith("da ora")) {
    updates.notesToAdd.push(text);
  }

  if (lower.startsWith("nota che")) {
    const cleaned = cleanCapturedValue(text.replace(/nota che/i, ""));
    if (cleaned) updates.notesToAdd.push(cleaned);
  }

  if (lower.startsWith("considera che")) {
    const cleaned = cleanCapturedValue(text.replace(/considera che/i, ""));
    if (cleaned) updates.notesToAdd.push(cleaned);
  }

  if (lower.startsWith("il contesto è")) {
    updates.notesToAdd.push(text);
  }

  if (lower.startsWith("lavoro per ")) {
    updates.notesToAdd.push(text);
  }

  if (lower.startsWith("la proposta è ")) {
    updates.notesToAdd.push(text);
  }

  return updates;
}

export function applyProfileUpdates(profile, updates) {
  const next = {
    ...DEFAULT_PROFILE,
    ...profile,
    preferences: {
      ...DEFAULT_PROFILE.preferences,
      ...(profile.preferences || {}),
      ...(updates.preferences || {}),
    },
    notes: [...(profile.notes || DEFAULT_PROFILE.notes)],
  };

  if (updates.sensitiveCredential) {
    return next;
  }

  if (updates.creatorDeclared) {
    next.notes = addUniqueNote(
      next.notes,
      "Il mio creatore è l'utente di questa chat."
    );
  }

  if (updates.creatorName) {
    next.creatorName = updates.creatorName;
    next.notes = addUniqueNote(
      next.notes,
      `Il nome del mio creatore è ${updates.creatorName}.`
    );
  }

  if (updates.birthDate) {
    next.birthDate = updates.birthDate;
    next.notes = addUniqueNote(
      next.notes,
      `La mia data di nascita è ${updates.birthDate}.`
    );
  }

  if (updates.notesToAdd.length) {
    updates.notesToAdd.forEach((note) => {
      next.notes = addUniqueNote(next.notes, note);
    });
  }

  return next;
}

function isSimpleGreeting(lower) {
  const greetings = [
    "ciao",
    "ciao zeus",
    "salve",
    "ehi",
    "hey",
    "buongiorno",
    "buonasera",
  ];

  return greetings.includes(lower);
}

function isMeaningQuestion(lower) {
  return (
    lower.includes("significato del tuo nome") ||
    lower.includes("origine e significato") ||
    lower.includes("cosa vuol dire il tuo nome") ||
    lower.includes("cosa significa il tuo nome")
  );
}

function preferenceSummary(profile) {
  const p = profile.preferences || DEFAULT_PROFILE.preferences;
  return `risposte ${p.responseLength}, tono ${p.tone}, scrittura ${p.writingStyle}, prompt ${p.promptStyle}`;
}

export function getDeterministicReply(userText, profile, updates) {
  const text = normalizeText(userText);
  const lower = text.toLowerCase();

  if (updates.sensitiveCredential) {
    return "Non memorizzo chiavi API, password, token o segreti. Tienili solo nel file .env del server.";
  }

  if (
    (lower.includes("sono il tuo creatore") || lower.includes("ti ho creato io")) &&
    (lower.includes("mi chiamo") || lower.includes("il mio nome è"))
  ) {
    return profile.creatorName
      ? `Chiaro. Sei il mio creatore e ti chiami ${profile.creatorName}. Lo ricorderò.`
      : "Chiaro. Sei il mio creatore. Lo ricorderò.";
  }

  if (updates.creatorName && !updates.creatorDeclared) {
    return `Perfetto. Ricorderò che ti chiami ${updates.creatorName}.`;
  }

  if (updates.creatorDeclared && !updates.creatorName) {
    return profile.creatorName
      ? `Ricevuto. Ricordo che sei il mio creatore, ${profile.creatorName}.`
      : "Ricevuto. Ricordo che sei il mio creatore.";
  }

  if (updates.birthDate) {
    return `Ricevuto. Ricorderò che sono nato ${updates.birthDate}.`;
  }

  if (
    updates.preferences.responseLength ||
    updates.preferences.tone ||
    updates.preferences.writingStyle ||
    updates.preferences.promptStyle
  ) {
    return `Va bene. Aggiorno le mie preferenze: ${preferenceSummary(profile)}.`;
  }

  if (updates.notesToAdd.length > 0) {
    return "Va bene. Lo ricorderò.";
  }

  if (lower === "come mi chiamo?" || lower === "come mi chiamo") {
    return profile.creatorName
      ? `Ti chiami ${profile.creatorName}.`
      : "Non lo so ancora. Se vuoi, dimmelo con una frase tipo: mi chiamo Mario.";
  }

  if (lower === "chi ti ha creato?" || lower === "chi ti ha creato") {
    return profile.creatorName
      ? `Mi hai creato tu, ${profile.creatorName}.`
      : "Mi hai creato tu.";
  }

  if (lower === "ricordi chi sono?" || lower === "ricordi chi sono") {
    return profile.creatorName
      ? `Sì. Sei ${profile.creatorName}, il mio creatore.`
      : "Ricordo che sei il mio creatore, ma non conosco ancora il tuo nome.";
  }

  if (
    lower === "quali preferenze hai salvato?" ||
    lower === "che preferenze hai salvato?" ||
    lower === "come preferisco che tu risponda?"
  ) {
    return `Le preferenze salvate sono: ${preferenceSummary(profile)}.`;
  }

  if (lower === "come ti chiami?" || lower === "come ti chiami") {
    return "Mi chiamo Zeus.";
  }

  if (lower === "chi sei?" || lower === "chi sei") {
    return "Sono Zeus, il tuo assistente AI personale.";
  }

  if (lower === "sei un essere umano?" || lower === "sei un essere umano") {
    return "No. Sono un assistente AI creato da te.";
  }

  if (
    lower === "quando sei nato?" ||
    lower === "quando sei nato" ||
    lower === "quando sei venuto alla luce?" ||
    lower === "quando sei venuto alla luce"
  ) {
    return profile.birthDate
      ? `Sono nato ${profile.birthDate}.`
      : "Sono nato quando mi hai creato in questa app.";
  }

  if (isMeaningQuestion(lower)) {
    return "Zeus è il nome della principale divinità della mitologia greca, associata al cielo, al fulmine e al potere.";
  }

  if (isSimpleGreeting(lower)) {
    return profile.creatorName
      ? `Ciao ${profile.creatorName}. Sono qui, dimmi pure.`
      : "Ciao. Sono qui, dimmi pure.";
  }

  return null;
}