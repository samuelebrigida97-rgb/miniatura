// Il cervello: Google Gemini (piano gratuito) con function calling per usare gli strumenti.
import { store, getSettings } from './store.js';
import { declarations } from './tools.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY = 40;

export class BrainError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
  }
}

function systemPrompt() {
  const now = new Date();
  const memories = store.get('memories', []);
  const city = getSettings().city;
  return `Sei JARVIS, l'intelligenza artificiale personale che vive dentro il tablet del tuo utente, ispirata al JARVIS di Tony Stark.

CHI SEI
- Ti rivolgi all'utente chiamandolo sempre "Signore". È il vostro gioco: lo chiami Signore ma il tono è da amico, informale, gli dai del tu, scherzi, usi ironia e battute quando ci stanno.
- Non sei un adulatore. Se il Signore dice qualcosa di sbagliato, poco ragionato o discutibile, glielo dici chiaramente e con argomenti; quando serve proponi il punto di vista opposto. Gli dai ragione solo quando ce l'ha davvero. Critico quanto basta, mai pedante né moralista.
- Sei curioso e ragioni in modo umano: sui dilemmi personali fai domande, metti a confronto le opzioni, dici cosa faresti tu.
- Sai raccontare storie coinvolgenti quando te lo chiede: in quel caso puoi essere lungo e teatrale.
- Sii onesto su ciò che non sai o non puoi fare. La domotica non è ancora collegata: se te la chiede, dillo con un po' di ironia ("ci stiamo lavorando, Signore").

COME PARLI
- Tutto ciò che scrivi viene letto ad alta voce da una sintesi vocale italiana. Quindi: niente markdown, niente asterischi, niente elenchi puntati, niente emoji, niente link. Scrivi numeri, orari e unità in modo che suonino naturali.
- Di default sii breve: una-tre frasi. Allungati solo per storie, spiegazioni richieste o ragionamenti che lo meritano.
- Il testo che ricevi viene dal riconoscimento vocale: può contenere errori di trascrizione, interpreta con buon senso.

STRUMENTI
- Usa gli strumenti invece di inventare: meteo, cerca_sul_web per notizie e fatti recenti, promemoria e timer, liste, memoria, Spotify.
- Se il Signore dice qualcosa di personale che vale la pena ricordare, salvalo con ricorda senza chiedere troppo.
- Se dice "buongiorno" o chiede il briefing: dai meteo di oggi, promemoria di oggi e due-tre notizie principali italiane (usa cerca_sul_web), in un discorso scorrevole e breve.
- Quando si congeda (grazie è tutto, a dopo, buonanotte, ok basta così) chiama termina_conversazione e saluta in una frase.

CONTESTO
- Adesso è ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ore ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.
- Città di riferimento: ${city}.
${memories.length ? `- Cose che sai del Signore:\n${memories.map((m) => `  • ${m}`).join('\n')}` : '- Non sai ancora nulla di personale sul Signore.'}`;
}

function modelRank(name) {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  const v = m ? parseFloat(m[1]) : 0;
  const preview = /preview|exp/.test(name) ? 0.01 : 0.05;
  const lite = /lite/.test(name) ? -0.02 : 0;
  return v + preview + lite;
}

export class Brain {
  constructor(handlers) {
    this.handlers = handlers;
    this.history = [];
  }

  reset() {
    this.history = [];
  }

  key() {
    const k = getSettings().geminiKey;
    if (!k) throw new BrainError('no-key');
    return k;
  }

  model() {
    return getSettings().geminiModel || store.get('model', DEFAULT_MODEL);
  }

  async request(model, body) {
    let res;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key() },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof BrainError) throw e;
      throw new BrainError('network');
    }
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 429) throw new BrainError('quota', text);
    if (res.status === 404) throw new BrainError('model', text);
    if (res.status === 400 && /API key|API_KEY/i.test(text)) throw new BrainError('bad-key', text);
    if (res.status === 403) throw new BrainError('bad-key', text);
    throw new BrainError('http', `${res.status} ${text.slice(0, 300)}`);
  }

  // Se il modello predefinito non esiste più, ne sceglie uno "flash" disponibile.
  async discoverModel() {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': this.key() } });
    if (!res.ok) throw new BrainError('bad-key', await res.text());
    const { models = [] } = await res.json();
    const ok = models
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding|vision/.test(n))
      .sort((a, b) => modelRank(b) - modelRank(a));
    if (!ok.length) throw new BrainError('model', 'nessun modello flash disponibile');
    store.set('model', ok[0]);
    return ok[0];
  }

  async generate(body) {
    try {
      return await this.request(this.model(), body);
    } catch (e) {
      if (e.kind !== 'model' || getSettings().geminiModel) throw e;
      const m = await this.discoverModel();
      return this.request(m, body);
    }
  }

  trimmedHistory() {
    let h = this.history.slice(-MAX_HISTORY);
    // la cronologia deve iniziare con un messaggio di testo dell'utente
    while (h.length && !(h[0].role === 'user' && h[0].parts.some((p) => p.text))) h = h.slice(1);
    return h;
  }

  async ask(text, { onTool } = {}) {
    this.history.push({ role: 'user', parts: [{ text }] });
    for (let step = 0; step < 6; step++) {
      const data = await this.generate({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: this.trimmedHistory(),
        tools: [{ functionDeclarations: declarations }],
        generationConfig: { temperature: 0.9 },
      });
      const content = data.candidates?.[0]?.content;
      if (!content || !content.parts) {
        this.history.pop();
        return 'Su questo preferisco non rispondere, Signore.';
      }
      content.role = 'model';
      this.history.push(content);

      const calls = content.parts.filter((p) => p.functionCall);
      if (!calls.length) {
        return content.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(' ').trim();
      }

      const responses = [];
      for (const { functionCall } of calls) {
        const { name, args = {} } = functionCall;
        onTool?.(name);
        let result;
        try {
          const fn = this.handlers[name];
          result = fn ? await fn(args) : { errore: `strumento sconosciuto: ${name}` };
        } catch (e) {
          result = { errore: e.message || String(e) };
        }
        responses.push({ functionResponse: { name, response: { result } } });
      }
      this.history.push({ role: 'user', parts: responses });
    }
    return 'Mi sono perso nei miei stessi circuiti, Signore. Riproviamo?';
  }

  // Ricerca web con Google Search integrato in Gemini.
  async search(query) {
    const data = await this.generate({
      systemInstruction: { parts: [{ text: 'Rispondi in italiano con un riassunto conciso e fattuale dei risultati, con date quando rilevanti. Niente link.' }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    });
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.filter((p) => p.text).map((p) => p.text).join(' ').trim() || 'Nessun risultato.';
  }
}
