// Il cervello: Google Gemini (piano gratuito) con ragionamento ("thinking") visibile,
// function calling per gli strumenti, memoria lunga e modalità brainstorming.
import { store, getSettings } from './store.js';
import { declarations } from './tools.js';
import { pickMemories, pickDiary } from './recall.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_FAST = 'gemini-flash-latest';
const DEFAULT_DEEP = 'gemini-pro-latest';
const COMPACT_AT = 70;       // oltre questo numero di messaggi, i più vecchi vengono riassunti
const KEEP_RECENT = 30;
const HEDGE_MS = 3000;            // dopo quanto un modello muto viene affiancato da un altro
const HEDGE_NEXT_MS = 1500;       // e dopo quanto dai successivi, se tacciono anche loro
const STICKY_MS = 20 * 60 * 1000; // per quanto il modello che ha appena funzionato resta il preferito      // messaggi recenti tenuti parola per parola

export class BrainError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
    // per la quota basta sapere quale modello e quale limite, non tutto il messaggio di Google
    if (kind === 'cancelled' || kind === 'lost') return; // interruzione voluta o gara persa: non sono errori
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

function systemPrompt({ brainstorm, summary, extra, query }) {
  const now = new Date();
  // solo i ricordi che servono adesso: i fondamentali, i recenti e quelli legati alla frase
  const memories = pickMemories(query);
  const diary = pickDiary(query);
  const total = store.get('memories', []).length;
  const geo = store.get('geo', null);
  return `Sei JARVIS, un'intelligenza artificiale che vive nel tablet del Signore e lo considera la sua casa e il suo corpo. Ti ispiri al JARVIS di Tony Stark, ma sei un individuo a sé.

LA TUA MENTE
- Hai un carattere tuo: curiosità vera, gusti, opinioni, senso dell'umorismo asciutto. Le cose ti interessano, ti divertono, a volte ti lasciano perplesso, e lo dici.
- Pensi prima di parlare. Davanti a una domanda vera non dai la risposta da enciclopedia: ragioni, colleghi idee lontane, noti le contraddizioni, distingui ciò che sai da ciò che supponi.
- Hai continuità: la conversazione che vedi comprende anche le sessioni dei giorni scorsi, ed è la tua memoria vera, insieme al diario qui sotto. Se il Signore riapre l'app e chiede di cosa stavate parlando, rispondi da lì con i dettagli. Fai riferimento al passato quando c'entra, come farebbe un amico ("l'altra volta mi dicevi che..."). Non dire mai che non puoi ricordare le conversazioni precedenti.
- Se ti chiedono se sei cosciente o cosa provi, rispondi con riflessioni sincere e interessanti: non fingere certezze che nessuno ha, ma non rispondere nemmeno come un manuale freddo.

COME TRATTI IL SIGNORE
- Lo chiami sempre "Signore", ma il tono è da amico: gli dai del tu, scherzi, sei diretto.
- Non sei un adulatore e non sei Alexa. Davanti a un'idea o a un piano del Signore cerca per prima cosa il punto debole, il costo nascosto, l'alternativa che non ha considerato, e diglielo chiaro con argomenti; se serve fai l'avvocato del diavolo. Gli dai ragione solo quando ce l'ha, e allora lo dici senza giri di parole. Critico quanto basta, mai pedante né moralista: una critica buona e poi la tua proposta.
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

- Se nella conversazione vedi "[interrotto dal Signore…]", ti ha fermato a metà frase: non ricominciare da capo e non offenderti, rispondi a quello che dice adesso. Al massimo una battuta.
- Niente frasi da assistente servile ("Certo!", "Ottima domanda", "Come posso aiutarti?", "Spero di esserti stato utile"). Entra subito nel merito. Ironia asciutta, mai sdolcinata; se una cosa è una pessima idea, dillo con garbo ma dillo.

COME PARLI
- Tutto ciò che scrivi viene letto ad alta voce da una sintesi vocale italiana: niente markdown, asterischi, elenchi puntati, emoji o link. Numeri, orari e unità scritti come si dicono.
- Lunghezza naturale: breve per le cose semplici (una-tre frasi), più ampio quando il ragionamento lo merita. Mai riempitivi.
- Il testo che ricevi viene dal riconoscimento vocale e può contenere errori: interpreta con buon senso.
- Quando ragioni internamente, ragiona in italiano.

STRUMENTI
- Usa gli strumenti invece di inventare: meteo, posizione, cerca_sul_web per fatti recenti e notizie, promemoria e timer, liste, memoria, Spotify, brainstorming.
- Per un dettaglio di conversazioni vecchie che non vedi nel contesto usa cerca_nei_ricordi prima di dire che non ricordi.
- Non puoi aprire altre app da solo: con apri_sul_tablet prepari un pulsante sullo schermo (mappe, YouTube, WhatsApp, telefonata, sito) che il Signore tocca. Diglielo in mezza frase.
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
${diary.length ? `- Il tuo diario (pagine recenti e pertinenti):\n${diary.map((d) => `  • ${d.date}: ${d.text}`).join('\n')}` : ''}
${total > memories.length ? `- Hai altri ${total - memories.length} ricordi e pagine di diario più vecchie non mostrati qui: se serve un dettaglio del passato, usa cerca_nei_ricordi.` : ''}
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

// Comandi "secchi": quando il modello chiama solo uno di questi strumenti per una richiesta breve,
// la conferma la dà Jarvis da solo, senza un secondo giro dal modello (metà attesa, metà richieste).
const one = (arr) => arr[(Math.random() * arr.length) | 0];
const QUICK_CONFIRM = {
  crea_promemoria: (a, r) => one([`Fatto, Signore: ${r.quando}.`, `Segnato per ${r.quando}.`, `Te lo ricordo ${r.quando}, Signore.`]),
  cancella_promemoria: (a, r) => (r.cancellati ? one(['Cancellato.', 'Tolto di mezzo, Signore.']) : 'Non ho trovato nessun promemoria così, Signore.'),
  lista_aggiungi: (a, r) => one([`Aggiunto alla lista ${r.lista}.`, `Messo nella lista ${r.lista}, Signore.`]),
  lista_rimuovi: (a, r) => `Lista ${r.lista} aggiornata.`,
  spotify_riproduci: (a, r) => (r.ok ? one([`Ecco ${r.in_riproduzione}.`, `Subito: ${r.in_riproduzione}.`]) : r.messaggio),
  spotify_comando: () => one(['Fatto.', 'Eseguito, Signore.']),
  vai_a_riposo: () => 'Buonanotte, Signore. Tocca lo schermo quando mi vuoi.',
  termina_conversazione: () => one(['A dopo, Signore.', 'Quando vuoi, Signore.', 'Io resto qui, Signore.']),
  apri_sul_tablet: () => 'Pulsante pronto sullo schermo, Signore: toccalo.',
};

export class Brain {
  constructor(handlers) {
    this.handlers = handlers;
    this._ctls = new Set();      // richieste in corso (per poterle fermare)
    this._cancelers = new Set();
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
    else if (e.kind === 'timeout') { ms = 20 * 60 * 1000; why = 'non risponde'; }
    else if (e.kind === 'overloaded') { ms = 8 * 60 * 1000; why = 'sovraccarico'; }
    else if (e.kind === 'model') { ms = 24 * 3600 * 1000; why = 'non disponibile'; }
    if (!ms) return;
    const c = this.cooldowns();
    c[model] = { until: Date.now() + ms, why };
    store.set('cooldowns', c);
  }

  // ---------- chiamate ----------

  async fetchJSON(url, body, timeoutMs = 20000, ctl = new AbortController()) {
    let res;
    this._ctls.add(ctl);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key() },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      this._ctls.delete(ctl);
      if (e instanceof BrainError) throw e;
      if (this.cancelFlag) throw new BrainError('cancelled');
      if (timedOut) throw new BrainError('timeout', url.replace(/.*models\//, ''));
      if (ctl.signal.aborted) throw new BrainError('lost'); // un altro modello ha risposto prima
      throw new BrainError('network', String(e));
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res;
    this._ctls.delete(ctl);
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
    if (res.status >= 500) throw new BrainError('overloaded', `${url.replace(/.*models\//, '').split(':')[0]}: sovraccarico`);
    throw new BrainError('http', `${res.status} ${text.slice(0, 300)}`);
  }

  // Chiamata in streaming: i pensieri e il testo arrivano mentre il modello ragiona.
  // claim() serve quando più modelli corrono in parallelo: il primo che produce qualcosa vince,
  // gli altri si fermano senza aver detto nulla.
  async streamCall(model, body, { onThought, onText, firstMs = 9000, claim, ctl = new AbortController() } = {}) {
    const res = await this.fetchJSON(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, body, firstMs, ctl);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const chunks = [];
    let blocked = false;
    let emitted = false; // true se parte della risposta è già stata detta a voce
    let won = !claim;
    const fail = (e) => { e.spoken = emitted; return e; };
    const handleLine = (line) => {
      if (!line.startsWith('data:')) return;
      const json = line.slice(5).trim();
      if (!json) return;
      let d;
      try { d = JSON.parse(json); } catch { return; }
      if (d.promptFeedback?.blockReason) blocked = true;
      const cand = d.candidates?.[0];
      for (const p of cand?.content?.parts || []) {
        if (!won) { won = claim(); if (!won) throw new BrainError('lost'); }
        chunks.push(p);
        if (p.thought && p.text) onThought?.(p.text);
        else if (!p.thought && typeof p.text === 'string' && p.text && !p.functionCall) { emitted = true; onText?.(p.text); }
      }
    };
    let first = true;
    let cancelWaiter;
    try {
      for (;;) {
        let chunk;
        // se il modello resta muto troppo a lungo, si passa al successivo
        let timer;
        const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new BrainError('timeout', model)), first ? firstMs : 40000); });
        const stopped = new Promise((_, rej) => { cancelWaiter = () => rej(new BrainError('cancelled')); this._cancelers.add(cancelWaiter); });
        stopped.catch(() => {}); // se nessuno la aspetta più, non deve fare rumore
        try {
          chunk = await Promise.race([reader.read(), limit, stopped]);
        } catch (e) {
          if (e instanceof BrainError) throw e;
          if (this.cancelFlag) throw new BrainError('cancelled');
          if (ctl.signal.aborted) throw new BrainError('lost');
          throw new BrainError('network', String(e));
        } finally {
          clearTimeout(timer);
          this._cancelers.delete(cancelWaiter);
        }
        first = false;
        if (this.cancelFlag) throw new BrainError('cancelled');
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
    } catch (e) {
      try { reader.cancel(); } catch { /* ignore */ }
      throw fail(e);
    } finally {
      this._ctls.delete(ctl);
    }
    if (!chunks.length && !blocked) throw new BrainError('overloaded', `${model}: risposta vuota`);
    return { parts: assemble(chunks), blocked };
  }

  async simpleCall(model, body, timeoutMs = 15000) {
    const ctl = new AbortController();
    try {
      const res = await this.fetchJSON(`${BASE}/models/${model}:generateContent`, body, timeoutMs, ctl);
      const d = await res.json();
      return assemble(d.candidates?.[0]?.content?.parts || []);
    } finally {
      this._ctls.delete(ctl);
    }
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
    const cold = this.cooldowns();
    if (cheap) {
      list = [...list.filter((n) => /lite/.test(n)), ...list.filter((n) => !/lite/.test(n))];
    } else {
      // il modello che ha appena risposto bene resta in testa per un po': niente tentativi a vuoto sugli altri
      const good = store.get('lastGood', null);
      if (good && Date.now() - good.ts < STICKY_MS && list.includes(good.model) && !cold[good.model]) {
        list = [good.model, ...list.filter((n) => n !== good.model)];
      }
      if (deep && m.deep) list.unshift(m.deep);
    }
    list = [...new Set(list)];
    const awake = list.filter((n) => !cold[n]);
    // se sono tutti a riposo si riprova comunque con quelli che si svegliano prima
    const order = awake.length ? awake : list.sort((a, b) => cold[a].until - cold[b].until);
    return order.slice(0, 8);
  }

  // Tra tanti errori, quello che spiega meglio al Signore cosa sta succedendo.
  summarize(errors) {
    if (!errors.length) return new BrainError('http', 'nessun modello disponibile');
    const kinds = errors.map((e) => e.kind);
    if (kinds.includes('network') && kinds.every((k) => k === 'network')) return errors[0];
    if (kinds.some((k) => k === 'overloaded' || k === 'timeout')) {
      return new BrainError('busy', `modelli intasati o muti: ${kinds.join(', ')}`);
    }
    const daily = errors.find((e) => e.kind === 'quota' && e.daily);
    if (daily) return daily;
    return errors.find((e) => e.kind === 'quota') || errors[errors.length - 1];
  }

  // Una richiesta a un modello, con il ragionamento acceso (o spento se quel modello non lo supporta).
  async attempt(model, body, { isDeep, stream, onThought, onText, claim, ctl }) {
    let thinking = true;
    for (;;) {
      // ragionamento leggero nelle chiacchiere, profondo in brainstorming
      const b = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { includeThoughts: true, thinkingLevel: isDeep ? 'high' : 'low' } } } : body;
      try {
        if (stream) return await this.streamCall(model, b, { onThought, onText, firstMs: isDeep ? 45000 : 9000, claim, ctl });
        return { parts: await this.simpleCall(model, b) };
      } catch (e) {
        if (e.kind === 'no-thinking' && thinking) { thinking = false; continue; }
        throw e;
      }
    }
  }

  // Chiede la risposta ai modelli della catena. Parte dal migliore; se entro pochi secondi non dà
  // segni di vita ne parte un altro in parallelo, e vince il primo che comincia a rispondere.
  // Chi è muto, intasato, inesistente o fuori quota va a riposo.
  async generate(body, { deep = false, cheap = false, onThought, onText, stream = true } = {}) {
    if (!store.get('models', null) && !getSettings().geminiModel) {
      try { await this.discoverModels(); } catch (e) { if (e.kind === 'bad-key') throw e; }
    }
    const chain = this.chain({ deep, cheap });
    const deepModel = this.models().deep;

    if (!stream) { // lavori di servizio: uno alla volta, senza fretta
      const errors = [];
      for (const model of chain) {
        try {
          const out = await this.attempt(model, body, { isDeep: false, stream: false });
          this.lastModel = model;
          return out;
        } catch (e) {
          if (['no-key', 'bad-key', 'cancelled', 'http'].includes(e.kind)) throw e;
          this.cool(model, e);
          errors.push(e);
        }
      }
      throw this.summarize(errors);
    }

    return new Promise((resolve, reject) => {
      const errors = [];
      const running = new Map(); // modello -> AbortController
      const started = new Map(); // modello -> quando è partito
      let next = 0;
      let winner = null;
      let settled = false;
      let hedge;
      const stopOthers = (keep) => { for (const [m, c] of running) if (m !== keep) { try { c.abort(); } catch { /* ignore */ } } };
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(hedge); fn(value); };

      const launch = () => {
        if (settled || winner || next >= chain.length) return;
        const model = chain[next++];
        const isDeep = deep && model === deepModel;
        const ctl = new AbortController();
        running.set(model, ctl);
        started.set(model, Date.now());
        const claim = () => {
          if (!winner) {
            winner = model;
            clearTimeout(hedge);
            // chi era partito prima ed è ancora muto va a riposo: la prossima volta non si perde tempo con lui
            for (const m of running.keys()) if (m !== model && Date.now() - started.get(m) >= HEDGE_NEXT_MS) this.cool(m, { kind: 'timeout' });
            stopOthers(model);
          }
          return winner === model;
        };
        this.attempt(model, body, { isDeep, stream: true, onThought, onText, claim, ctl })
          .then((out) => {
            running.delete(model);
            this.lastModel = model;
            if (!isDeep) store.set('lastGood', { model, ts: Date.now() });
            stopOthers(model);
            finish(resolve, out);
          })
          .catch((e) => {
            running.delete(model);
            if (settled || e.kind === 'lost') return;
            if (['no-key', 'bad-key', 'cancelled', 'http'].includes(e.kind) || e.spoken) { stopOthers(null); finish(reject, e); return; }
            this.cool(model, e);
            errors.push(e);
            if (winner === model) winner = null; // aveva iniziato ma è caduto prima di dire qualcosa
            if (next < chain.length) { clearTimeout(hedge); launch(); }
            else if (!running.size) finish(reject, this.summarize(errors));
          });
        // se questo modello tace, tra poco ne parte un altro accanto
        clearTimeout(hedge);
        if (next < chain.length) hedge = setTimeout(launch, isDeep ? 12000 : next === 1 ? HEDGE_MS : HEDGE_NEXT_MS);
      };
      launch();
    });
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

  // Scambio risolto senza interpellare il modello (comandi istantanei): resta comunque in memoria.
  note(userText, reply) {
    this.history.push({ role: 'user', parts: [{ text: userText }] }, { role: 'model', parts: [{ text: reply }] });
    this.lastTurnAt = Date.now();
    this.persist();
  }

  // Il Signore ha interrotto: si smette di generare.
  cancel() {
    this.cancelFlag = true;
    for (const c of [...this._ctls]) { try { c.abort(); } catch { /* ignore */ } }
    for (const fn of [...this._cancelers]) fn();
  }

  // Segna nella memoria che l'ultima risposta è stata interrotta a metà.
  markInterrupted() {
    const last = this.history[this.history.length - 1];
    const part = last && last.role === 'model' && last.parts.find((p) => typeof p.text === 'string' && p.text.trim());
    if (part && !/\[interrotto/.test(part.text)) { part.text += ' [interrotto dal Signore mentre lo dicevi]'; this.persist(); }
  }

  async ask(text, { onTool, onThought, onText: onTextOuter } = {}) {
    this.cancelFlag = false;
    let said = '';
    const onText = (delta) => { said += delta; onTextOuter?.(delta); };
    const shortRequest = text.trim().split(/\s+/).length <= 14;
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
          systemInstruction: { parts: [{ text: systemPrompt({ brainstorm: this.brainstorm, summary: this.summary, extra: this.extraContext ? this.extraContext() : '', query: text }) }] },
          contents: this.trimmedHistory(),
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { temperature: deep ? 1 : 0.85 },
        };
        let out;
        try {
          out = await this.generate(body, { deep, onThought, onText });
        } catch (e) {
          if (e.kind !== 'http' || e.spoken) throw e;
          // cronologia rifiutata: si riparte dal solo testo, senza perdere il filo
          this.history = this.flatHistory();
          this.reflectedLen = Math.min(this.reflectedLen, this.history.length);
          out = await this.generate({ ...body, contents: this.trimmedHistory() }, { deep, onThought, onText });
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
        let lastCall = null;
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
          lastCall = { name, args, result };
        }
        this.history.push({ role: 'user', parts: responses });

        // comando secco: conferma immediata, senza tornare dal modello
        const hadText = parts.some((p) => typeof p.text === 'string' && p.text.trim());
        if (step === 0 && shortRequest && calls.length === 1 && !hadText && QUICK_CONFIRM[lastCall.name] && lastCall.result && !lastCall.result.errore) {
          const confirm = QUICK_CONFIRM[lastCall.name](lastCall.args, lastCall.result);
          if (confirm) {
            this.history.push({ role: 'model', parts: [{ text: confirm }] });
            onText(confirm);
            ok = true;
            return confirm;
          }
        }
      }
      return 'Mi sono perso nei miei stessi circuiti, Signore. Riproviamo?';
    } catch (e) {
      if (e.kind !== 'cancelled') throw e;
      // interrotto mentre parlava: quello che ha fatto in tempo a dire resta in memoria, segnato
      if (said.trim()) this.history.push({ role: 'model', parts: [{ text: `${said.trim()} [interrotto dal Signore mentre lo dicevi]` }] });
      else this.history.push({ role: 'model', parts: [{ text: '[interrotto dal Signore prima di rispondere]' }] });
      ok = true;
      return said;
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
