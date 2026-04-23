function getZeusDemoReply(userText) {
  const text = userText.toLowerCase();

  if (text.includes("ciao")) {
    return "Ciao. Sto bene e sono pronto ad aiutarti.";
  }

  if (text.includes("come stai")) {
    return "Sto bene. Dimmi pure cosa ti serve.";
  }

  if (text.includes("prompt")) {
    return "Posso aiutarti a scrivere prompt più chiari per immagini, video o idee creative.";
  }

  if (text.includes("immagini")) {
    return "Posso aiutarti a costruire prompt per generare immagini in modo più preciso.";
  }

  if (text.includes("video")) {
    return "Posso aiutarti a pensare prompt e struttura per video, anche se per ora sono ancora in modalità demo.";
  }

  if (text.includes("organizza") || text.includes("organizzazione")) {
    return "Posso aiutarti a mettere ordine nelle idee e trasformarle in passaggi concreti.";
  }

  return `Ho ricevuto il tuo messaggio: "${userText}". Per ora sono ancora in modalità demo, ma la chat sta funzionando bene.`;
}

export default getZeusDemoReply;