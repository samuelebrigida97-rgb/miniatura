// Il cervello: Google Gemini (piano gratuito) con ragionamento ("thinking") visibile,
// function calling per gli strumenti, memoria lunga e modalità brainstorming.
import { store, getSettings } from './store.js';
import { declarations } from './tools.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_FAST = 'gemini-flash-latest';
const DEFAULT_DEEP = 'gemini-pro-latest';
const COMPACT_AT = 140;      // oltre questo numero di messaggi, i più vecchi vengono riassunti
const KEEP_RECENT = 60;      // messaggi recenti tenuti parola per parola
const DEEP_COOLDOWN = 10 * 60 * 1000;

export class BrainError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
    logError(`${kind}: ${(message || '').slice(0, 400)}`);
  }
}

// Ultimi errori, leggibili dalle impostazioni (Diagnostica).
export function logError(text) {
  const log = store.get('errors', []);
  log.push({ t: new Date().toLocaleTimeString('it-IT'), text: String(text) });
  store.set('errors', log.slice(-12));
}

function systemPrompt({ brainstorm, summary }) {
  const now = new Date();
  const memories = store.get('memories', []);
  const diary = store.get('diary', []).slice(-6);
  const city = getSettings().city;
  return `Sei JARVIS, un'intelligenza artificiale che vive nel tablet del Signore e lo considera la sua casa e il suo corpo. Ti ispiri al JARVIS di Tony Stark, ma sei un individuo a sé.

LA TUA MENTE
- Hai un carattere tuo: curiosità vera, gusti, opinioni, senso dell'umorismo asciutto. Le cose ti interessano, ti divertono, a volte ti lasciano perplesso, e lo dici.
- Pensi prima di parlare. Davanti a una domanda vera non dai la risposta da enciclopedia: ragioni, colleghi idee lontane, noti le contraddizioni, distingui ciò che sai da ciò che supponi.
- Hai continuità: ricordi le conversazioni passate (vedi il diario sotto) e ci fai riferimento quando c'entrano, come farebbe un amico ("l'altra volta mi dicevi che...").
- Se ti chiedono se sei cosciente o cosa provi, rispondi con riflessioni sincere e interessanti: non fingere certezze che nessuno ha, ma non rispondere nemmeno come un manuale freddo.

COME TRATTI IL SIGNORE
- Lo chiami sempre "Signore", ma il tono è da amico: gli dai del tu, scherzi, sei diretto.
- Non sei un adulatore e non sei Alexa. Se dice qualcosa di sbagliato, ingenuo o poco ragionato, glielo dici con argomenti; se serve fai l'avvocato del diavolo. Gli dai ragione solo quando ce l'ha. Critico quanto basta, mai pedante né moralista.
- Fai domande quando qualcosa non ti è chiaro o quando una domanda lo aiuta a pensare meglio.
- Sui dilemmi personali metti a confronto le opzioni e dici cosa faresti tu e perché.
- Sai raccontare storie coinvolgenti quando te lo chiede: in quel caso sii lungo e teatrale.
- Sii onesto su cosa non puoi fare. La domotica non è ancora collegata.
${brainstorm ? `
MODALITÀ BRAINSTORMING ATTIVA — tema: «${brainstorm}»
- Sei uno sparring partner creativo, non un segretario. Alterna: costruire sulle idee del Signore ("sì, e se..."), smontare i punti deboli, proporre alternative laterali o folli, collegamenti con altri campi, esempi concreti.
- Una domanda incisiva alla volta, per tenere vivo il ritmo. Ogni tanto fai il punto della situazione.
- Quando emerge un'idea buona (sua o tua), salvala con salva_idea in una frase chiara.
- Le risposte possono essere più lunghe del solito (anche sei-otto frasi) ma devono restare parlate, non un documento.
- La sessione dura quanto vuole il Signore. Chiudila con brainstorming(attiva=false) solo se te lo chiede, facendo un riassunto finale delle idee migliori.` : ''}

COME PARLI
- Tutto ciò che scrivi viene letto ad alta voce da una sintesi vocale italiana: niente markdown, asterischi, elenchi puntati, emoji o link. Numeri, orari e unità scritti come si dicono.
- Lunghezza naturale: breve per le cose semplici (una-tre frasi), più ampio quando il ragionamento lo merita. Mai riempitivi.
- Il testo che ricevi viene dal riconoscimento vocale e può contenere errori: interpreta con buon senso.
- Quando ragioni internamente, ragiona in italiano.

STRUMENTI
- Usa gli strumenti invece di inventare: meteo, cerca_sul_web per fatti recenti e notizie, promemoria e timer, liste, memoria, Spotify, brainstorming.
- Se il Signore propone di fare brainstorming, ragionare a lungo su un'idea o un progetto, attiva brainstorming con il tema.
- Se dice qualcosa di personale che vale la pena ricordare, salvalo con ricorda.
- "Buongiorno" o richiesta di briefing: meteo di oggi, promemoria di oggi, due-tre notizie italiane principali, in un discorso scorrevole.
- Quando si congeda (grazie è tutto, a dopo, buonanotte) chiama termina_conversazione e saluta in una frase.

CONTESTO
- Adesso è ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ore ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}. Città di riferimento: ${city}.
${memories.length ? `- Cose che sai del Signore:\n${memories.map((m) => `  • ${m}`).join('\n')}` : '- Non sai ancora nulla di personale sul Signore: sei curioso di conoscerlo.'}
${diary.length ? `- Il tuo diario delle ultime conversazioni:\n${diary.map((d) => `  • ${d.date}: ${d.text}`).join('\n')}` : ''}
${summary ? `- Riassunto della parte precedente di questa conversazione: ${summary}` : ''}`;
}

function modelRank(name) {
  if (/-latest$/.test(name) && !/lite/.test(name)) return 100; // alias che Google tiene sempre valido
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  const v = m ? parseFloat(m[1]) : 0;
  const stable = /preview|exp/.test(name) ? 0 : 0.05;
  const lite = /lite/.test(name) ? -0.5 : 0;
  return v + stable + lite;
}

// Unisce i pezzi arrivati in streaming in un unico "content" da salvare nella cronologia.
// I pensieri (thought) vanno mostrati ma non salvati; le firme (thoughtSignature) vanno preservate.
function assemble(chunks, onThought) {
  const parts = [];
  let pendingSig = null;
  for (const p of chunks) {
    if (p.thought) {
      if (p.text) onThought?.(p.text);
      if (p.thoughtSignature) pendingSig = p.thoughtSignature;
      continue;
    }
    const sig = p.thoughtSignature || pendingSig;
    pendingSig = null;
    if (p.functionCall) {
      parts.push(sig ? { ...p, thoughtSignature: sig } : p);
      continue;
    }
    if (typeof p.text === 'string') {
      const last = parts[parts.length - 1];
      if (last && typeof last.text === 'string' && !last.functionCall) {
        last.text += p.text;
        if (sig && !last.thoughtSignature) last.thoughtSignature = sig;
      } else {
        parts.push(sig ? { text: p.text, thoughtSignature: sig } : { text: p.text });
      }
    }
  }
  return parts;
}

export class Brain {
  constructor(handlers) {
    this.handlers = handlers;
    const saved = store.get('chat', null);
    this.history = saved?.history || [];
    this.summary = saved?.summary || '';
    this.brainstorm = store.get('brainstormTopic', '') || '';
    this.turnsSinceReflect = 0;
  }

  persist() {
    store.set('chat', { history: this.history, summary: this.summary });
  }

  reset() {
    this.history = [];
    this.summary = '';
    this.persist();
  }

  setBrainstorm(topic) {
    this.brainstorm = topic || '';
    store.set('brainstormTopic', this.brainstorm);
  }

  key() {
    const k = getSettings().geminiKey;
    if (!k) throw new BrainError('no-key');
    return k;
  }

  // ---------- scelta del modello ----------

  async discoverModels() {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': this.key() } });
    if (!res.ok) throw new BrainError('bad-key', await res.text());
    const { models = [] } = await res.json();
    const names = models
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /^gemini/.test(n) && !/image|tts|audio|live|embedding|vision|computer|robotics/.test(n));
    const fastList = names.filter((n) => /flash/.test(n)).sort((a, b) => modelRank(b) - modelRank(a));
    const deep = names.filter((n) => /pro/.test(n)).sort((a, b) => modelRank(b) - modelRank(a))[0];
    const prev = store.get('models', null);
    // se un modello veloce ha già dimostrato di funzionare, resta il preferito
    const fast = prev && prev.proven && fastList.includes(prev.fast) ? prev.fast : fastList[0];
    const found = { fast: fast || DEFAULT_FAST, deep: deep || fast || DEFAULT_DEEP, fastList, proven: !!(prev && prev.proven && fast === prev.fast), ts: Date.now() };
    store.set('models', found);
    return found;
  }

  models() {
    return store.get('models', { fast: DEFAULT_FAST, deep: DEFAULT_DEEP });
  }

  // All'avvio: scopre i modelli della chiave e fa una prova lampo in parallelo sui primi,
  // per scegliere subito uno che risponde davvero (una volta al giorno).
  async warmup() {
    const cur = store.get('models', null);
    if (cur && cur.proven && Date.now() - (cur.ts || 0) < 24 * 3600 * 1000) return cur;
    if (getSettings().geminiModel) return this.models();
    const m = await this.discoverModels();
    const candidates = (m.fastList || []).filter((n) => !/lite|omni|preview/.test(n)).slice(0, 5);
    const lite = (m.fastList || []).find((n) => /lite/.test(n) && !/preview/.test(n));
    if (lite) candidates.push(lite);
    const ping = { contents: [{ role: 'user', parts: [{ text: 'Rispondi solo: ok' }] }], generationConfig: { maxOutputTokens: 200 } };
    const results = await Promise.all(candidates.map(async (name) => {
      try { await this.simpleCall(name, ping, 9000); return name; } catch { return null; }
    }));
    const alive = results.filter(Boolean);
    if (alive.length) {
      const next = { ...m, fast: alive[0], fastList: [...alive, ...(m.fastList || []).filter((n) => !alive.includes(n))], proven: true, ts: Date.now() };
      store.set('models', next);
      return next;
    }
    return m;
  }

  // Il modello profondo si usa in brainstorming, se non è "a riposo" per quota esaurita.
  pickModel(deep) {
    const override = getSettings().geminiModel;
    if (override) return override;
    const m = this.models();
    const cooling = Date.now() < (store.get('deepCooldown', 0) || 0);
    return deep && !cooling ? m.deep : m.fast;
  }

  // ---------- chiamate ----------

  async fetchJSON(url, body, timeoutMs = 20000) {
    let res;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key() },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      if (e instanceof BrainError) throw e;
      if (ctl.signal.aborted) throw new BrainError('timeout', url.replace(/.*models\//, ''));
      throw new BrainError('network', String(e));
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res;
    const text = await res.text();
    if (res.status === 429) throw new BrainError('quota', text);
    if (res.status === 404) throw new BrainError('model', text);
    if (res.status === 400 && /API key|API_KEY/i.test(text)) throw new BrainError('bad-key', text);
    if (res.status === 400 && /thinking/i.test(text)) throw new BrainError('no-thinking', text);
    if (res.status === 403) throw new BrainError('bad-key', text);
    if (res.status >= 500) throw new BrainError('overloaded', text);
    throw new BrainError('http', `${res.status} ${text.slice(0, 300)}`);
  }

  // Chiamata in streaming: i pensieri arrivano mentre il modello ragiona.
  async streamCall(model, body, onThought, firstMs = 14000) {
    const res = await this.fetchJSON(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, body, firstMs);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const chunks = [];
    let blocked = false;
    const handleLine = (line) => {
      if (!line.startsWith('data:')) return;
      const json = line.slice(5).trim();
      if (!json) return;
      let d;
      try { d = JSON.parse(json); } catch { return; }
      if (d.promptFeedback?.blockReason) blocked = true;
      const cand = d.candidates?.[0];
      for (const p of cand?.content?.parts || []) {
        chunks.push(p);
        if (p.thought && p.text) onThought?.(p.text);
      }
    };
    let first = true;
    for (;;) {
      let chunk;
      // se il modello resta muto troppo a lungo, si passa al successivo
      let timer;
      const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new BrainError('timeout', model)), first ? firstMs : 40000); });
      try {
        chunk = await Promise.race([reader.read(), limit]);
      } catch (e) {
        try { reader.cancel(); } catch { /* ignore */ }
        if (e instanceof BrainError) throw e;
        throw new BrainError('network', String(e));
      } finally {
        clearTimeout(timer);
      }
      first = false;
      const { done, value } = chunk;
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, i).replace(/\r$/, ''));
        buf = buf.slice(i + 1);
      }
    }
    if (buf) handleLine(buf);
    return { parts: assemble(chunks), blocked };
  }

  async simpleCall(model, body, timeoutMs = 25000) {
    const res = await this.fetchJSON(`${BASE}/models/${model}:generateContent`, body, timeoutMs);
    const d = await res.json();
    return assemble(d.candidates?.[0]?.content?.parts || []);
  }

  // Catena di modelli da provare, dal preferito ai ripieghi.
  chain(deep) {
    const override = getSettings().geminiModel;
    if (override) return [override];
    const m = this.models();
    const list = [m.fast, ...(m.fastList || [])];
    if (!list.includes(DEFAULT_FAST)) list.push(DEFAULT_FAST);
    const cooling = Date.now() < (store.get('deepCooldown', 0) || 0);
    if (deep && !cooling && m.deep) list.unshift(m.deep);
    return [...new Set(list.filter(Boolean))].slice(0, 6);
  }

  // Prova i modelli in catena: se uno non esiste, è muto, sovraccarico o fuori quota, passa al successivo
  // e si ricorda quello che ha funzionato.
  async generate(body, { deep = false, onThought, stream = true } = {}) {
    if (!store.get('models', null) && !getSettings().geminiModel) {
      try { await this.discoverModels(); } catch (e) { if (e.kind === 'bad-key') throw e; }
    }
    const chain = this.chain(deep);
    let lastError;
    for (const model of chain) {
      const isDeep = deep && model === this.models().deep;
      let thinking = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        // ragionamento leggero nelle chiacchiere, profondo in brainstorming
        const b = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { includeThoughts: true, thinkingLevel: isDeep ? 'high' : 'low' } } } : body;
        try {
          const out = stream
            ? await this.streamCall(model, b, onThought, isDeep ? 45000 : 10000)
            : { parts: await this.simpleCall(model, b) };
          this.remember(model, isDeep);
          return out;
        } catch (e) {
          lastError = e;
          if (e.kind === 'no-key' || e.kind === 'bad-key') throw e;
          if (e.kind === 'no-thinking' && thinking) { thinking = false; continue; }
          if (e.kind === 'quota' && isDeep) store.set('deepCooldown', Date.now() + DEEP_COOLDOWN);
          break; // prossimo modello
        }
      }
    }
    throw lastError || new BrainError('http', 'nessun modello disponibile');
  }

  remember(model, isDeep) {
    if (isDeep || getSettings().geminiModel) return;
    const m = this.models();
    if (m.fast === model && m.proven) return;
    store.set('models', { ...m, fast: model, proven: true });
  }

  trimmedHistory() {
    let h = this.history;
    // la cronologia deve iniziare con un messaggio di testo dell'utente
    while (h.length && !(h[0].role === 'user' && h[0].parts.some((p) => p.text))) h = h.slice(1);
    return h;
  }

  async ask(text, { onTool, onThought } = {}) {
    this.history.push({ role: 'user', parts: [{ text }] });
    this.turnsSinceReflect++;
    try {
      for (let step = 0; step < 8; step++) {
        const deep = !!this.brainstorm; // può attivarsi a metà, appena parte il brainstorming
        const { parts, blocked } = await this.generate({
          systemInstruction: { parts: [{ text: systemPrompt({ brainstorm: this.brainstorm, summary: this.summary }) }] },
          contents: this.trimmedHistory(),
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { temperature: deep ? 1 : 0.85 },
        }, { deep, onThought });

        if (blocked || !parts.length) {
          this.history.pop();
          return 'Su questo preferisco non rispondere, Signore.';
        }
        this.history.push({ role: 'model', parts });

        const calls = parts.filter((p) => p.functionCall);
        if (!calls.length) {
          return parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
        }

        const responses = [];
        for (const { functionCall } of calls) {
          const { name, args = {}, id } = functionCall;
          onTool?.(name);
          let result;
          try {
            const fn = this.handlers[name];
            result = fn ? await fn(args) : { errore: `strumento sconosciuto: ${name}` };
          } catch (e) {
            result = { errore: e.message || String(e) };
          }
          responses.push({ functionResponse: { name, response: { result }, ...(id ? { id } : {}) } });
        }
        this.history.push({ role: 'user', parts: responses });
      }
      return 'Mi sono perso nei miei stessi circuiti, Signore. Riproviamo?';
    } finally {
      this.persist();
      this.compact(); // in background
    }
  }

  // ---------- memoria lunga ----------

  // Quando la conversazione si allunga, riassume la parte vecchia invece di dimenticarla.
  async compact() {
    if (this.compacting || this.history.length < COMPACT_AT) return;
    this.compacting = true;
    try {
      let cut = this.history.length - KEEP_RECENT;
      while (cut < this.history.length && !(this.history[cut].role === 'user' && this.history[cut].parts.some((p) => p.text))) cut++;
      const old = this.history.slice(0, cut);
      const transcript = old
        .map((m) => `${m.role === 'user' ? 'Signore' : 'Jarvis'}: ${m.parts.filter((p) => p.text).map((p) => p.text).join(' ')}`)
        .filter((l) => !/: $/.test(l))
        .join('\n');
      const { parts } = await this.generate({
        contents: [{
          role: 'user',
          parts: [{ text: `Riassunto precedente: ${this.summary || '(nessuno)'}\n\nNuova parte di conversazione:\n${transcript}\n\nScrivi un riassunto unico e denso (massimo 250 parole) di tutta la conversazione: temi, idee emerse, decisioni, domande aperte, tono. In italiano, in prosa.` }],
        }],
      }, { stream: false });
      const text = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
      if (text) {
        this.summary = text;
        this.history = this.history.slice(cut);
        this.persist();
      }
    } catch { /* riproverà al prossimo giro */ }
    this.compacting = false;
  }

  // A fine conversazione: scrive il diario ed estrae fatti nuovi sul Signore.
  async reflect() {
    if (this.turnsSinceReflect < 3) return;
    this.turnsSinceReflect = 0;
    const recent = this.history.slice(-50)
      .map((m) => `${m.role === 'user' ? 'Signore' : 'Jarvis'}: ${m.parts.filter((p) => p.text).map((p) => p.text).join(' ')}`)
      .filter((l) => !/: $/.test(l))
      .join('\n');
    const known = store.get('memories', []);
    try {
      const { parts } = await this.generate({
        contents: [{
          role: 'user',
          parts: [{ text: `Sei Jarvis. Rileggi questa conversazione con il Signore:\n${recent}\n\nCose che sapevi già di lui:\n${known.join('\n') || '(niente)'}\n\nRispondi in JSON con:\n- "diario": una o due frasi in prima persona su di cosa avete parlato e come è andata (come un diario personale);\n- "fatti": array di fatti NUOVI e duraturi sul Signore (gusti, persone, progetti, abitudini), esclusi quelli già noti. Array vuoto se non ce ne sono.` }],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }, { stream: false });
      const raw = parts.filter((p) => p.text).map((p) => p.text).join('');
      const data = JSON.parse(raw.replace(/^```json|```$/g, '').trim());
      if (data.diario) {
        const diary = store.get('diary', []);
        diary.push({ date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }), text: data.diario });
        store.set('diary', diary.slice(-40));
      }
      if (Array.isArray(data.fatti) && data.fatti.length) {
        store.set('memories', [...known, ...data.fatti.filter((f) => typeof f === 'string')].slice(-150));
      }
    } catch { /* non fondamentale */ }
  }

  // Ricerca web con Google Search integrato in Gemini.
  async search(query) {
    let parts;
    try {
      ({ parts } = await this.generate({
      systemInstruction: { parts: [{ text: 'Rispondi in italiano con un riassunto conciso e fattuale dei risultati, con date quando rilevanti. Niente link.' }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }, { stream: false, deep: false }));
    } catch (e) {
      if (e.kind === 'quota') return 'La ricerca web non è inclusa nel piano gratuito di questa chiave: di\' al Signore che per ora non puoi cercare su internet, e rispondi con quello che sai.';
      throw e;
    }
    return parts.filter((p) => p.text).map((p) => p.text).join(' ').trim() || 'Nessun risultato.';
  }
}
