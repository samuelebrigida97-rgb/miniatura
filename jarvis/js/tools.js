// Gli "strumenti" che il cervello può usare: meteo, ricerca web, promemoria, liste, memoria, Spotify.
import { store, getSettings, saveSettings } from './store.js';
import { spotify } from './spotify.js';
import { searchEverything } from './recall.js';

const WMO = {
  0: 'sereno', 1: 'prevalentemente sereno', 2: 'parzialmente nuvoloso', 3: 'coperto',
  45: 'nebbia', 48: 'nebbia gelata', 51: 'pioviggine leggera', 53: 'pioviggine', 55: 'pioviggine intensa',
  56: 'pioviggine gelata', 57: 'pioviggine gelata intensa', 61: 'pioggia leggera', 63: 'pioggia',
  65: 'pioggia forte', 66: 'pioggia gelata', 67: 'pioggia gelata forte', 71: 'neve leggera', 73: 'neve',
  75: 'neve forte', 77: 'nevischio', 80: 'rovesci leggeri', 81: 'rovesci', 82: 'rovesci violenti',
  85: 'rovesci di neve', 86: 'forti rovesci di neve', 95: 'temporale', 96: 'temporale con grandine',
  99: 'temporale con forte grandine',
};

export function weatherText(code) {
  return WMO[code] || 'condizioni variabili';
}

// ---------- posizione e meteo ----------
// Ordine: città scritta a mano nelle impostazioni > GPS del tablet > posizione approssimata dalla rete.

const GEO_TTL = 30 * 60 * 1000;

async function getJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(name) {
  const q = new URLSearchParams({ name, count: '1', language: 'it', format: 'json' });
  const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  const g = d.results?.[0];
  if (!g) throw new Error(`Non trovo il luogo "${name}".`);
  return { lat: g.latitude, lon: g.longitude, name: g.name, region: g.admin1 || '', country: g.country || '' };
}

// Dalle coordinate al nome del posto.
async function reverseName(lat, lon) {
  try {
    const q = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: '10', 'accept-language': 'it' });
    const d = await getJSON(`https://nominatim.openstreetmap.org/reverse?${q}`);
    const a = d.address || {};
    const name = a.city || a.town || a.village || a.municipality || d.name;
    if (name) return { name, region: a.state || '', country: a.country || '' };
  } catch { /* prova il servizio di riserva */ }
  try {
    const q = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: 'it' });
    const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?${q}`);
    const name = d.city || d.locality;
    if (name) return { name, region: d.principalSubdivision || '', country: d.countryName || '' };
  } catch { /* niente nome */ }
  return null;
}

function gps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}

// Senza permesso GPS: posizione stimata dall'indirizzo di rete (può sbagliare città).
async function ipLocation() {
  try {
    const d = await getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=it');
    if (typeof d.latitude === 'number') {
      return { lat: d.latitude, lon: d.longitude, name: d.city || d.locality || 'posizione sconosciuta', region: d.principalSubdivision || '', country: d.countryName || '' };
    }
  } catch { /* niente */ }
  return null;
}

export function knownLocation() {
  return store.get('geo', null);
}

export async function locate(place, { force = false } = {}) {
  if (place) return geocode(place);

  const manual = (getSettings().place || '').trim();
  const cached = store.get('geo', null);
  if (manual) {
    if (cached && cached.source === 'manuale' && cached.query === manual.toLowerCase()) return cached;
    const g = await geocode(manual);
    const loc = { ...g, source: 'manuale', query: manual.toLowerCase(), ts: Date.now() };
    store.set('geo', loc);
    return loc;
  }

  if (!force && cached && cached.source !== 'manuale' && Date.now() - cached.ts < GEO_TTL) return cached;

  const pos = await gps();
  if (pos) {
    // se non ci si è spostati, il nome già noto resta valido
    const same = cached && cached.source === 'gps' && Math.abs(cached.lat - pos.lat) < 0.02 && Math.abs(cached.lon - pos.lon) < 0.02;
    const named = same ? { name: cached.name, region: cached.region, country: cached.country } : await reverseName(pos.lat, pos.lon);
    const loc = { lat: pos.lat, lon: pos.lon, ...(named || { name: 'posizione attuale', region: '', country: '' }), source: 'gps', ts: Date.now() };
    store.set('geo', loc);
    return loc;
  }

  const ip = await ipLocation();
  if (ip) {
    const loc = { ...ip, source: 'rete', ts: Date.now() };
    store.set('geo', loc);
    return loc;
  }
  if (cached && cached.source !== 'manuale') return cached; // meglio un dato vecchio che niente
  throw new Error('Non riesco a capire dove si trova il tablet: serve il permesso di posizione, oppure la città scritta nelle impostazioni.');
}

export async function getWeather(place) {
  const loc = await locate(place);
  const q = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon, timezone: 'auto', forecast_days: '3',
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  // memoria breve: l'HUD e le domande a voce non interrogano il servizio due volte in pochi minuti
  const key = `${Number(loc.lat).toFixed(2)},${Number(loc.lon).toFixed(2)}`;
  const cache = store.get('weatherCache', null);
  let d;
  if (cache && cache.key === key && Date.now() - cache.ts < 10 * 60 * 1000) {
    d = cache.data;
  } else {
    try {
      d = await getJSON(`https://api.open-meteo.com/v1/forecast?${q}`, 10000);
      if (!d || !d.current) throw new Error('risposta meteo incompleta');
      store.set('weatherCache', { key, ts: Date.now(), data: d });
    } catch (e) {
      // servizio momentaneamente irraggiungibile: meglio il dato di poco fa che niente
      if (cache && cache.key === key && Date.now() - cache.ts < 3 * 3600 * 1000) d = cache.data;
      else throw new Error('Il servizio meteo non risponde in questo momento.');
    }
  }
  const days = ['oggi', 'domani', 'dopodomani'];
  return {
    luogo: loc.name,
    regione: loc.region || undefined,
    posizione_approssimata: loc.source === 'rete' ? true : undefined,
    adesso: {
      temperatura: Math.round(d.current.temperature_2m),
      percepita: Math.round(d.current.apparent_temperature),
      cielo: weatherText(d.current.weather_code),
      vento_kmh: Math.round(d.current.wind_speed_10m),
      umidita: d.current.relative_humidity_2m,
    },
    previsioni: d.daily.time.map((_, i) => ({
      giorno: days[i],
      cielo: weatherText(d.daily.weather_code[i]),
      max: Math.round(d.daily.temperature_2m_max[i]),
      min: Math.round(d.daily.temperature_2m_min[i]),
      probabilita_pioggia: d.daily.precipitation_probability_max[i],
    })),
    _code: d.current.weather_code,
    _source: loc.source,
  };
}

// ---------- promemoria ----------

export const reminders = {
  all() { return store.get('reminders', []); },
  save(list) { store.set('reminders', list); },
  add(text, due) {
    const list = this.all();
    const r = { id: Date.now().toString(36), text, due };
    list.push(r);
    list.sort((a, b) => a.due - b.due);
    this.save(list);
    return r;
  },
  remove(id) { this.save(this.all().filter((r) => r.id !== id)); },
  due(now = Date.now()) { return this.all().filter((r) => r.due <= now); },
};

function fmtWhen(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `oggi alle ${time}` : `${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${time}`;
}

// ---------- ricerca web (Gemini + Google Search, gratis entro i limiti) ----------

let brainRef = null;
export function bindBrain(brain) { brainRef = brain; }

// ---------- definizioni per Gemini ----------

const S = (type, description, extra = {}) => ({ type, description, ...extra });

export const declarations = [
  {
    name: 'meteo',
    description: 'Meteo attuale e previsioni per 3 giorni. Senza luogo usa la posizione reale del tablet (GPS).',
    parameters: { type: 'OBJECT', properties: { luogo: S('STRING', 'Città, opzionale') } },
  },
  {
    name: 'cerca_sul_web',
    description: 'Cerca su Google informazioni aggiornate: notizie, risultati sportivi, fatti recenti, orari, prezzi. Usalo per tutto ciò che può essere cambiato dopo il tuo addestramento.',
    parameters: { type: 'OBJECT', properties: { domanda: S('STRING', 'Cosa cercare, in italiano') }, required: ['domanda'] },
  },
  {
    name: 'dove_sono',
    description: 'Rileva di nuovo dove si trova il tablet in questo momento (GPS) e restituisce città e regione.',
  },
  {
    name: 'imposta_citta',
    description: 'Fissa a mano la città del Signore, quando dice dove si trova o dove abita e la posizione rilevata è sbagliata. Con citta vuota torna alla posizione automatica (GPS).',
    parameters: { type: 'OBJECT', properties: { citta: S('STRING', 'Nome della città, oppure vuoto per tornare al GPS') }, required: ['citta'] },
  },
  {
    name: 'cerca_nei_ricordi',
    description: 'Cerca in tutta la tua memoria (ricordi sul Signore, diario, idee dei brainstorming, liste, conversazioni passate) i passaggi che parlano di un argomento. Usalo per recuperare dettagli vecchi che non hai sotto gli occhi.',
    parameters: { type: 'OBJECT', properties: { argomento: S('STRING', 'Parole chiave di cosa cercare') }, required: ['argomento'] },
  },
  {
    name: 'apri_sul_tablet',
    description: 'Prepara sullo schermo un pulsante che, toccato dal Signore, apre un\'altra app o un sito: indicazioni stradali, video su YouTube, messaggio WhatsApp, telefonata, pagina web. Non si apre da solo: serve il suo tocco.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cosa: S('STRING', 'Che cosa aprire', { enum: ['mappa', 'youtube', 'whatsapp', 'telefonata', 'sito', 'ricerca'] }),
        testo: S('STRING', 'Destinazione o luogo (mappa), cosa cercare (youtube, ricerca), testo del messaggio (whatsapp), indirizzo web (sito)'),
        numero: S('STRING', 'Numero di telefono con prefisso internazionale, per whatsapp e telefonata'),
      },
      required: ['cosa'],
    },
  },
  {
    name: 'vai_a_riposo',
    description: 'Modalità notte: spegne l\'ascolto e oscura lo schermo finché il Signore non lo tocca. Usalo quando dice buonanotte, vai a dormire, o chiede silenzio per la notte. Saluta in una frase.',
  },
  {
    name: 'data_ora',
    description: 'Data e ora esatte in questo momento.',
  },
  {
    name: 'crea_promemoria',
    description: 'Crea un promemoria, un timer o una sveglia. Usa tra_minuti per durate relative ("tra 10 minuti") oppure data_ora per un momento preciso.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messaggio: S('STRING', 'Cosa ricordare (per un timer semplice: "Il timer è scaduto")'),
        tra_minuti: S('NUMBER', 'Minuti da adesso, anche decimali (0.5 = 30 secondi)'),
        data_ora: S('STRING', 'Data e ora locali in formato AAAA-MM-GGTHH:MM'),
      },
      required: ['messaggio'],
    },
  },
  { name: 'elenca_promemoria', description: 'Elenca i promemoria e timer attivi.' },
  {
    name: 'cancella_promemoria',
    description: 'Cancella promemoria. Passa parte del testo per trovarli, oppure "tutti".',
    parameters: { type: 'OBJECT', properties: { testo: S('STRING', 'Parte del testo del promemoria, o "tutti"') }, required: ['testo'] },
  },
  {
    name: 'lista_aggiungi',
    description: 'Aggiunge elementi a una lista (es. "spesa", "cose da fare").',
    parameters: {
      type: 'OBJECT',
      properties: { lista: S('STRING', 'Nome della lista'), elementi: { type: 'ARRAY', items: { type: 'STRING' } } },
      required: ['lista', 'elementi'],
    },
  },
  {
    name: 'lista_leggi',
    description: 'Legge una lista. Senza nome restituisce tutte le liste.',
    parameters: { type: 'OBJECT', properties: { lista: S('STRING', 'Nome della lista') } },
  },
  {
    name: 'lista_rimuovi',
    description: 'Rimuove elementi da una lista, oppure svuota la lista se elementi è vuoto.',
    parameters: {
      type: 'OBJECT',
      properties: { lista: S('STRING', 'Nome della lista'), elementi: { type: 'ARRAY', items: { type: 'STRING' } } },
      required: ['lista'],
    },
  },
  {
    name: 'ricorda',
    description: 'Salva nella memoria a lungo termine un fatto sul Signore (gusti, persone, abitudini, progetti). Usalo quando il Signore ti dice qualcosa che vale la pena ricordare o ti chiede di ricordarlo.',
    parameters: { type: 'OBJECT', properties: { fatto: S('STRING', 'Il fatto, in una frase') }, required: ['fatto'] },
  },
  {
    name: 'dimentica',
    description: 'Cancella dalla memoria i fatti che contengono un certo testo.',
    parameters: { type: 'OBJECT', properties: { testo: S('STRING', 'Testo da cercare') }, required: ['testo'] },
  },
  {
    name: 'spotify_riproduci',
    description: 'Fa partire musica su Spotify: un brano, un artista, un album o una playlist.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cerca: S('STRING', 'Cosa cercare, es. "Bohemian Rhapsody Queen" o "lo-fi per studiare"'),
        tipo: S('STRING', 'track, artist, album o playlist', { enum: ['track', 'artist', 'album', 'playlist'] }),
      },
      required: ['cerca'],
    },
  },
  {
    name: 'spotify_comando',
    description: 'Controlla la riproduzione di Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {
        azione: S('STRING', 'Azione', { enum: ['pausa', 'riprendi', 'successivo', 'precedente', 'volume', 'shuffle'] }),
        valore: S('STRING', 'Per volume: 0-100. Per shuffle: on/off'),
      },
      required: ['azione'],
    },
  },
  { name: 'spotify_cosa_suona', description: 'Dice quale brano sta suonando su Spotify.' },
  {
    name: 'brainstorming',
    description: 'Attiva o chiude la modalità brainstorming: sessione lunga di idee su un tema, con ragionamento più profondo e una lavagna di idee sullo schermo. Riattivando un tema già usato, ritrovi le idee salvate.',
    parameters: {
      type: 'OBJECT',
      properties: {
        attiva: S('BOOLEAN', 'true per iniziare, false per chiudere'),
        tema: S('STRING', 'Il tema della sessione, breve (es. "app per studenti", "regalo per Giulia")'),
      },
      required: ['attiva'],
    },
  },
  {
    name: 'salva_idea',
    description: 'Salva un\'idea buona sulla lavagna del brainstorming in corso.',
    parameters: { type: 'OBJECT', properties: { idea: S('STRING', 'L\'idea, in una frase chiara') }, required: ['idea'] },
  },
  {
    name: 'leggi_idee',
    description: 'Legge le idee salvate per un tema di brainstorming (o elenca i temi se non specificato).',
    parameters: { type: 'OBJECT', properties: { tema: S('STRING', 'Tema, opzionale') } },
  },
  {
    name: 'termina_conversazione',
    description: 'Chiudi la conversazione e torna in attesa della parola "Jarvis". Usalo quando il Signore si congeda (es. "grazie è tutto", "a dopo", "buonanotte").',
  },
];

// ---------- esecuzione ----------

export function createHandlers(ctx) {
  return {
    async meteo({ luogo }) {
      const w = await getWeather(luogo);
      delete w._code;
      delete w._source;
      return w;
    },

    async dove_sono() {
      const loc = await locate(null, { force: true });
      ctx.onLocationChanged();
      return { citta: loc.name, regione: loc.region, paese: loc.country, fonte: loc.source, approssimata: loc.source === 'rete' };
    },

    async imposta_citta({ citta }) {
      saveSettings({ place: (citta || '').trim() });
      store.remove('geo');
      const loc = await locate(null, { force: true });
      ctx.onLocationChanged();
      return { ok: true, citta: loc.name, regione: loc.region, fonte: loc.source };
    },

    async cerca_nei_ricordi({ argomento }) {
      const trovati = searchEverything(argomento, brainRef ? brainRef.history.slice(0, -1) : [], brainRef ? brainRef.summary : '');
      return trovati.length ? { trovati } : { trovati: [], nota: 'Nessun ricordo su questo argomento.' };
    },

    async apri_sul_tablet({ cosa, testo = '', numero = '' }) {
      const t = encodeURIComponent(String(testo).trim());
      const n = String(numero).replace(/[^\d+]/g, '');
      let url; let label;
      switch (cosa) {
        case 'mappa': url = `https://www.google.com/maps/dir/?api=1&destination=${t}`; label = `Indicazioni per ${testo}`; break;
        case 'youtube': url = `https://www.youtube.com/results?search_query=${t}`; label = `YouTube: ${testo}`; break;
        case 'whatsapp':
          if (!n) return { errore: 'Per WhatsApp serve il numero con prefisso internazionale.' };
          url = `https://wa.me/${n.replace('+', '')}${t ? `?text=${t}` : ''}`; label = `WhatsApp a ${numero}`; break;
        case 'telefonata':
          if (!n) return { errore: 'Serve il numero di telefono.' };
          url = `tel:${n}`; label = `Chiama ${numero}`; break;
        case 'sito': {
          const raw = String(testo).trim();
          if (!raw) return { errore: 'Serve l\'indirizzo del sito.' };
          url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; label = `Apri ${raw.replace(/^https?:\/\//i, '')}`; break;
        }
        default: url = `https://www.google.com/search?q=${t}`; label = `Cerca: ${testo}`;
      }
      ctx.offerLink(label, url);
      return { ok: true, nota: 'Pulsante pronto sullo schermo: il Signore deve toccarlo. Quando esce da Jarvis, l\'ascolto si ferma finché non torna.' };
    },

    async vai_a_riposo() {
      ctx.rest();
      return { ok: true };
    },

    async cerca_sul_web({ domanda }) {
      if (!brainRef) return { errore: 'ricerca non disponibile' };
      return { risultato: await brainRef.search(domanda) };
    },

    async data_ora() {
      const d = new Date();
      return {
        data: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        ora: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      };
    },

    async crea_promemoria({ messaggio, tra_minuti, data_ora }) {
      let due;
      if (tra_minuti != null && !Number.isNaN(Number(tra_minuti))) {
        due = Date.now() + Number(tra_minuti) * 60000;
      } else if (data_ora) {
        due = new Date(data_ora).getTime();
      }
      if (!due || Number.isNaN(due)) return { errore: 'Non ho capito quando. Serve tra_minuti oppure data_ora.' };
      if (due < Date.now() - 60000) return { errore: 'Quel momento è già passato.' };
      const r = reminders.add(messaggio, due);
      ctx.onRemindersChanged();
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      return { ok: true, quando: fmtWhen(r.due) };
    },

    async elenca_promemoria() {
      const list = reminders.all();
      if (!list.length) return { promemoria: [] };
      return { promemoria: list.map((r) => ({ testo: r.text, quando: fmtWhen(r.due) })) };
    },

    async cancella_promemoria({ testo }) {
      const all = reminders.all();
      const t = (testo || '').toLowerCase();
      const keep = t === 'tutti' ? [] : all.filter((r) => !r.text.toLowerCase().includes(t));
      reminders.save(keep);
      ctx.onRemindersChanged();
      return { cancellati: all.length - keep.length };
    },

    async lista_aggiungi({ lista, elementi = [] }) {
      const lists = store.get('lists', {});
      const key = lista.toLowerCase().trim();
      lists[key] = [...(lists[key] || []), ...elementi];
      store.set('lists', lists);
      return { lista: key, elementi: lists[key] };
    },

    async lista_leggi({ lista }) {
      const lists = store.get('lists', {});
      if (!lista) return { liste: lists };
      return { lista, elementi: lists[lista.toLowerCase().trim()] || [] };
    },

    async lista_rimuovi({ lista, elementi }) {
      const lists = store.get('lists', {});
      const key = lista.toLowerCase().trim();
      if (!elementi || !elementi.length) {
        delete lists[key];
      } else {
        const drop = elementi.map((e) => e.toLowerCase());
        lists[key] = (lists[key] || []).filter((x) => !drop.some((d) => x.toLowerCase().includes(d)));
      }
      store.set('lists', lists);
      return { lista: key, elementi: lists[key] || [] };
    },

    async ricorda({ fatto }) {
      const mem = store.get('memories', []);
      mem.push(fatto);
      store.set('memories', mem.slice(-150));
      return { ok: true };
    },

    async dimentica({ testo }) {
      const mem = store.get('memories', []);
      const t = testo.toLowerCase();
      const keep = mem.filter((m) => !m.toLowerCase().includes(t));
      store.set('memories', keep);
      return { dimenticati: mem.length - keep.length };
    },

    async spotify_riproduci({ cerca, tipo }) {
      const r = await spotify.play(cerca, tipo);
      ctx.onSpotifyChanged();
      if (r.ok) ctx.musicStarted(); // la musica parte a volume pieno e Jarvis torna in attesa
      return r;
    },

    async spotify_comando({ azione, valore }) {
      if (azione === 'volume') spotify._ducked = null; // non ripristinare il volume vecchio
      const r = await spotify.control(azione, valore);
      ctx.onSpotifyChanged();
      return r;
    },

    async spotify_cosa_suona() {
      return spotify.nowPlaying();
    },

    async brainstorming({ attiva, tema }) {
      const boards = store.get('boards', {});
      if (!attiva) {
        const t = brainRef?.brainstorm;
        brainRef?.setBrainstorm('');
        ctx.onBrainstormChanged();
        return { ok: true, idee_della_sessione: t ? boards[t] || [] : [] };
      }
      const key = (tema || 'idee libere').toLowerCase().trim();
      // riusa un tema simile già esistente
      const existing = Object.keys(boards).find((k) => k.includes(key) || key.includes(k)) || key;
      boards[existing] = boards[existing] || [];
      store.set('boards', boards);
      brainRef?.setBrainstorm(existing);
      ctx.onBrainstormChanged();
      return { ok: true, tema: existing, idee_gia_salvate: boards[existing] };
    },

    async salva_idea({ idea }) {
      const boards = store.get('boards', {});
      const key = brainRef?.brainstorm || 'idee libere';
      boards[key] = [...(boards[key] || []), idea];
      store.set('boards', boards);
      ctx.onBrainstormChanged();
      return { ok: true, totale_idee: boards[key].length };
    },

    async leggi_idee({ tema }) {
      const boards = store.get('boards', {});
      if (!tema) return { temi: Object.keys(boards).map((k) => ({ tema: k, idee: boards[k].length })) };
      const key = Object.keys(boards).find((k) => k.includes(tema.toLowerCase()) || tema.toLowerCase().includes(k));
      return key ? { tema: key, idee: boards[key] } : { errore: 'Nessun tema simile trovato.' };
    },

    async termina_conversazione() {
      ctx.endConversation();
      return { ok: true };
    },
  };
}
