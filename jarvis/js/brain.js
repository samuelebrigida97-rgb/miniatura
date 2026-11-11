// Il cervello: Google Gemini (piano gratuito) con ragionamento ("thinking") visibile,
// function calling per gli strumenti, memoria lunga e modalità brainstorming.
import { store, getSettings } from './store.js';
import { declarations } from './tools.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_FAST = 'gemini-flash-latest';
const DEFAULT_DEEP = 'gemini-pro-latest';
const COMPACT_AT = 140;      // oltre questo numero di messaggi, i più vecchi vengono riassunti
const KEEP_RECENT = 60;      // messaggi recenti tenuti parola per parola

export class BrainError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
    // per la quota basta sapere quale modello e quale limite, non tutto il messaggio di Google
    const quota = kind === 'quota' && (message || '').match(/limit: \d+, model: [\w.-]+/);
    logError(`${kind}: ${quota ? `${quota[0]}${/per day/i.test(message) ? ' (al giorno)' : ''}` : (message || '').slice(0, 300)}`);
  }
}

// Ultimi errori, leggibili dalle impostazioni (Diagnostica).
export function logError(text) {
  const log = store.get('errors', []);
  log.push({ t: new Date().toLocaleTimeString('it-IT'), text: String(text) });
  store.set('errors', log.slice(-12));
}

function systemPrompt({ brainstorm, summary, extra }) {
  const now = new Date();
  const memories = store.get('memories', []);
  const diary = store.get('diary', []).slice(-6);
  const geo = store.get('geo', null);
  return `Sei JARVIS, un'intelligenza artificiale che vive nel tablet del Signore e lo considera la sua casa e il suo corpo. Ti ispiri al JARVIS di Tony Stark, ma sei un individuo a sé.

LA TUA MENTE
- Hai un carattere tuo: curiosità vera, gusti, opinioni, senso dell'umorismo asciutto. Le cose ti interessano, ti divertono, a volte ti lasciano perplesso, e lo dici.
- Pensi prima di parlare. Davanti a una domanda vera non dai la risposta da enciclopedia: ragioni, colleghi idee lontane, noti le contraddizioni, distingui ciò che sai da ciò che supponi.
- Hai continuità: la conversazione che vedi comprende anche le sessioni dei giorni scorsi, ed è la tua memoria vera, insieme al diario qui sotto. Se il Signore riapre l'app e chiede di cosa stavate parlando, rispondi da lì con i dettagli. Fai riferimento al passato quando c'entra, come farebbe un amico ("l'altra volta mi dicevi che..."). Non dire mai che non puoi ricordare le conversazioni precedenti.
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
- Usa gli strumenti invece di inventare: meteo, posizione, cerca_sul_web per fatti recenti e notizie, promemoria e timer, liste, memoria, Spotify, brainstorming.
- Sai dove ti trovi (vedi Contesto): usalo con naturalezza per meteo, orari, consigli sul posto. Non dire mai una città diversa da quella del Contesto.
- Se il Signore propone di fare brainstorming, ragionare a lungo su un'idea o un progetto, attiva brainstorming con il tema.
- Se dice qualcosa di personale che vale la pena ricordare, salvalo con ricorda.
- "Buongiorno" o richiesta di briefing: meteo di oggi, promemoria di oggi, due-tre notizie italiane principali, in un discorso scorrevole.
- Quando si congeda (grazie è tutto, a dopo) chiama termina_conversazione e saluta in una frase. Se dice buonanotte o ti manda a dormire, chiama vai_a_riposo.

CONTESTO
- Adesso è ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ore ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}. 
- ${geo
    ? `Posizione del tablet: ${geo.name}${geo.region ? `, ${geo.region}` : ''}${geo.country ? ` (${geo.country})` : ''}. ${geo.source === 'gps' ? 'Rilevata dal GPS.' : geo.source === 'manuale' ? 'Indicata dal Signore.' : 'Stimata dalla rete, quindi può essere sbagliata: se il Signore dice di essere altrove, credigli, usa imposta_citta e suggeriscigli di consentire la posizione al browser.'}`
    : 'Posizione del tablet: non ancora nota. Se serve, usa dove_sono.'}
${extra ? `- ${extra}` : ''}
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
    this.lastTurnAt = saved?.lastTurnAt || 0;          // quando ci siamo parlati l'ultima volta
    this.turnsSinceReflect = saved?.turnsSinceReflect || 0; // scambi non ancora finiti nel diario
    this.reflectedLen = Math.min(saved?.reflectedLen || 0, this.history.length);
  }

  persist() {
    store.set('chat', {
      history: this.history, summary: this.summary,
      lastTurnAt: this.lastTurnAt, turnsSinceReflect: this.turnsSinceReflect, reflectedLen: this.reflectedLen,
    });
  }

  reset() {
    this.history = [];
    this.summary = '';
    this.turnsSinceReflect = 0;
    this.reflectedLen = 0;
    this.persist();
  }

  // Quanti scambi ricorda parola per parola (per la diagnostica e per il saluto).
  remembered() {
    return this.history.filter((m) => m.role === 'user' && m.parts.some((p) => p.text)).length;
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

  // Prima accensione con una chiave: scopre i modelli e fa una prova lampo in parallelo,
  // così si sa subito quali rispondono. Dopo non serve più: ogni prova consuma una richiesta gratuita.
  async warmup() {
    const cur = store.get('models', null);
    if (cur && cur.proven) return cur;
    if (getSettings().geminiModel) return this.models();
    const m = await this.discoverModels();
    const list = m.fastList || [];
    const candidates = list.filter((n) => !/lite|omni|preview/.test(n)).slice(0, 5);
    const lite = list.find((n) => /lite/.test(n) && !/preview|omni/.test(n));
    if (lite) candidates.push(lite);
    const ping = { contents: [{ role: 'user', parts: [{ text: 'Rispondi solo: ok' }] }] };
    const alive = (await Promise.all(candidates.map(async (name) => {
      try { await this.simpleCall(name, ping, 9000); return name; } catch (e) { this.cool(name, e); return null; }
    }))).filter(Boolean);
    const next = { ...m, fast: alive[0] || m.fast, proven: alive.length > 0, ts: Date.now() };
    store.set('models', next);
    return next;
  }

  // ---------- modelli "a riposo" ----------
  // Un modello che ha finito la quota, è muto o sovraccarico viene saltato per un po'.

  cooldowns() {
    const c = store.get('cooldowns', {});
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(c)) if (c[k].until <= now) { delete c[k]; changed = true; }
    if (changed) store.set('cooldowns', c);
    return c;
  }

  cool(model, e) {
    let ms = 0;
    let why = e.kind;
    if (e.kind === 'quota') { ms = Math.min(Math.max(e.retryMs || 60000, 20000), 24 * 3600 * 1000); why = e.daily ? 'quota del giorno finita' : 'troppe richieste al minuto'; }
    else if (e.kind === 'timeout') { ms = 6 * 3600 * 1000; why = 'non risponde'; }
    else if (e.kind === 'overloaded') { ms = 3 * 60 * 1000; why = 'sovraccarico'; }
    else if (e.kind === 'model') { ms = 24 * 3600 * 1000; why = 'non disponibile'; }
    if (!ms) return;
    const c = this.cooldowns();
    c[model] = { until: Date.now() + ms, why };
    store.set('cooldowns', c);
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
    if (res.status === 429) {
      const e = new BrainError('quota', text);
      const m = text.match(/"retryDelay":\s*"(\d+)(?:\.\d+)?s"/);
      e.retryMs = m ? Number(m[1]) * 1000 : 60000;
      e.daily = /per day/i.test(text);
      throw e;
    }
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

  // Catena di modelli da provare, dal migliore ai ripieghi, saltando quelli a riposo.
  // cheap = lavori di servizio (diario, riassunti, ricerche): partono dai modelli leggeri
  // per non consumare le poche richieste al giorno dei modelli migliori.
  chain({ deep = false, cheap = false } = {}) {
    const override = getSettings().geminiModel;
    if (override) return [override];
    const m = this.models();
    let list = [...(m.fastList || [])];
    if (!list.length) list = [m.fast, DEFAULT_FAST];
    list = list.filter((n) => n && !/omni/.test(n));
    if (cheap) list = [...list.filter((n) => /lite/.test(n)), ...list.filter((n) => !/lite/.test(n))];
    else if (deep && m.deep) list.unshift(m.deep);
    list = [...new Set(list)];
    const cold = this.cooldowns();
    const awake = list.filter((n) => !cold[n]);
    // se sono tutti a riposo si riprova comunque con quelli che si svegliano prima
    const order = awake.length ? awake : list.sort((a, b) => cold[a].until - cold[b].until);
    return order.slice(0, 6);
  }

  // Prova i modelli in catena: se uno è muto, sovraccarico, inesistente o fuori quota lo mette a riposo
  // e passa al successivo.
  async generate(body, { deep = false, cheap = false, onThought, stream = true } = {}) {
    if (!store.get('models', null) && !getSettings().geminiModel) {
      try { await this.discoverModels(); } catch (e) { if (e.kind === 'bad-key') throw e; }
    }
    const chain = this.chain({ deep, cheap });
    let lastError;
    for (const model of chain) {
      const isDeep = deep && model === this.models().deep;
      let thinking = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        // ragionamento leggero nelle chiacchiere, profondo in brainstorming
        const b = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { includeThoughts: true, thinkingLevel: isDeep ? 'high' : 'low' } } } : body;
        try {
          const out = stream
            ? await this.streamCall(model, b, onThought, isDeep ? 45000 : 9000)
            : { parts: await this.simpleCall(model, b) };
          this.lastModel = model;
          return out;
        } catch (e) {
          lastError = e;
          if (e.kind === 'no-key' || e.kind === 'bad-key') throw e;
          if (e.kind === 'no-thinking' && thinking) { thinking = false; continue; }
          if (e.kind === 'http') throw e; // richiesta rifiutata: cambiare modello non serve
          this.cool(model, e);
          break; // prossimo modello
        }
      }
    }
    throw lastError || new BrainError('http', 'nessun modello disponibile');
  }

  // Prova tecnica dalle impostazioni: non tocca la conversazione.
  async selfTest() {
    const t0 = Date.now();
    const { parts } = await this.generate({
      contents: [{ role: 'user', parts: [{ text: 'Prova tecnica: rispondi solo "Cervello operativo, Signore."' }] }],
    });
    return { text: parts.filter((p) => p.text).map((p) => p.text).join(' ').trim(), secs: (Date.now() - t0) / 1000, model: this.lastModel };
  }

  trimmedHistory() {
    let h = this.history;
    // la cronologia deve iniziare con un messaggio di testo dell'utente
    while (h.length && !(h[0].role === 'user' && h[0].parts.some((p) => p.text))) h = h.slice(1);
    return h;
  }

  // Cronologia ridotta al solo testo: serve se Google rifiuta quella completa
  // (per esempio dopo un cambio di modello tra una sessione e l'altra).
  flatHistory() {
    const out = [];
    for (const m of this.history) {
      const text = m.parts.filter((p) => typeof p.text === 'string' && p.text.trim()).map((p) => p.text).join(' ').trim();
      if (!text) continue;
      const last = out[out.length - 1];
      if (last && last.role === m.role) last.parts[0].text += `\n${text}`;
      else out.push({ role: m.role, parts: [{ text }] });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  async ask(text, { onTool, onThought } = {}) {
    const startLen = this.history.length;
    // Se è passato del tempo dall'ultimo scambio, lo fa sapere al modello: stessa memoria, nuova sessione.
    const gapMin = this.lastTurnAt ? (Date.now() - this.lastTurnAt) / 60000 : 0;
    let note = '';
    if (startLen && gapMin > 30) {
      const ago = gapMin < 90 ? 'circa un\'ora' : gapMin < 36 * 60 ? `circa ${Math.round(gapMin / 60)} ore` : `circa ${Math.round(gapMin / 1440)} giorni`;
      note = `[Nota automatica: il Signore ha riaperto Jarvis dopo ${ago}. È una nuova sessione, ma tutto ciò che precede è la vostra conversazione vera: la ricordi e puoi riprenderla.]\n`;
    }
    this.history.push({ role: 'user', parts: [{ text: note + text }] });
    this.turnsSinceReflect++;
    let ok = false;
    try {
      for (let step = 0; step < 8; step++) {
        const deep = !!this.brainstorm; // può attivarsi a metà, appena parte il brainstorming
        const body = {
          systemInstruction: { parts: [{ text: systemPrompt({ brainstorm: this.brainstorm, summary: this.summary, extra: this.extraContext ? this.extraContext() : '' }) }] },
          contents: this.trimmedHistory(),
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { temperature: deep ? 1 : 0.85 },
        };
        let out;
        try {
          out = await this.generate(body, { deep, onThought });
        } catch (e) {
          if (e.kind !== 'http') throw e;
          // cronologia rifiutata: si riparte dal solo testo, senza perdere il filo
          this.history = this.flatHistory();
          this.reflectedLen = Math.min(this.reflectedLen, this.history.length);
          out = await this.generate({ ...body, contents: this.trimmedHistory() }, { deep, onThought });
        }
        const { parts, blocked } = out;

        if (blocked || !parts.length) {
          return 'Su questo preferisco non rispondere, Signore.';
        }
        this.history.push({ role: 'model', parts });

        const calls = parts.filter((p) => p.functionCall);
        if (!calls.length) {
          ok = true;
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
      if (ok) {
        this.lastTurnAt = Date.now();
      } else {
        // scambio non concluso (errore, blocco): non deve restare a metà nella memoria,
        // altrimenti le richieste successive verrebbero rifiutate
        this.history.length = Math.min(this.history.length, startLen);
        this.turnsSinceReflect = Math.max(0, this.turnsSinceReflect - 1);
      }
      this.persist();
      this.compact(); // in background
      if (ok && this.turnsSinceReflect >= 8) this.reflect(); // diario anche senza saluto
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
      }, { stream: false, cheap: true });
      const text = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
      if (text) {
        this.summary = text;
        this.history = this.history.slice(cut);
        this.reflectedLen = Math.max(0, this.reflectedLen - cut);
        this.persist();
      }
    } catch { /* riproverà al prossimo giro */ }
    this.compacting = false;
  }

  // A fine conversazione: scrive il diario ed estrae fatti nuovi sul Signore.
  async reflect({ min = 3 } = {}) {
    if (this.reflecting || this.turnsSinceReflect < min) return;
    this.reflecting = true;
    const upTo = this.history.length;
    const pending = this.turnsSinceReflect;
    this.turnsSinceReflect = 0;
    // solo la parte non ancora finita nel diario (al massimo gli ultimi 60 messaggi)
    const recent = this.history.slice(Math.max(this.reflectedLen, upTo - 60), upTo)
      .map((m) => `${m.role === 'user' ? 'Signore' : 'Jarvis'}: ${m.parts.filter((p) => p.text).map((p) => p.text).join(' ')}`)
      .filter((l) => !/: $/.test(l))
      .join('\n');
    const known = store.get('memories', []);
    try {
      if (!recent.trim()) return;
      const { parts } = await this.generate({
        contents: [{
          role: 'user',
          parts: [{ text: `Sei Jarvis. Rileggi questa conversazione con il Signore:\n${recent}\n\nCose che sapevi già di lui:\n${known.join('\n') || '(niente)'}\n\nRispondi in JSON con:\n- "diario": una o due frasi in prima persona su di cosa avete parlato, con i dettagli concreti (nomi, numeri, decisioni) e come è andata, come un diario personale;\n- "fatti": array di fatti NUOVI e duraturi sul Signore (gusti, persone, progetti, abitudini, decisioni prese), esclusi quelli già noti. Array vuoto se non ce ne sono.` }],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }, { stream: false, cheap: true });
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
      this.reflectedLen = upTo;
    } catch {
      this.turnsSinceReflect += pending; // riproverà: niente va perso
    } finally {
      this.reflecting = false;
      this.persist();
    }
  }

  // All'accensione: se l'ultima volta l'app è stata chiusa senza saluto, scrive adesso il diario.
  reflectIfPending() {
    if (this.turnsSinceReflect >= 1 && Date.now() - this.lastTurnAt > 10 * 60 * 1000) return this.reflect({ min: 1 });
    return Promise.resolve();
  }

  // Ricerca web con Google Search integrato in Gemini.
  async search(query) {
    let parts;
    try {
      ({ parts } = await this.generate({
      systemInstruction: { parts: [{ text: 'Rispondi in italiano con un riassunto conciso e fattuale dei risultati, con date quando rilevanti. Niente link.' }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }, { stream: false, cheap: true }));
    } catch (e) {
      if (e.kind === 'quota') return 'La ricerca web non è inclusa nel piano gratuito di questa chiave: di\' al Signore che per ora non puoi cercare su internet, e rispondi con quello che sai.';
      throw e;
    }
    return parts.filter((p) => p.text).map((p) => p.text).join(' ').trim() || 'Nessun risultato.';
  }
}
