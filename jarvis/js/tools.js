// Gli "strumenti" che il cervello può usare: meteo, ricerca web, promemoria, liste, memoria, Spotify.
import { store, getSettings } from './store.js';
import { spotify } from './spotify.js';

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

async function geocode(name) {
  const q = new URLSearchParams({ name, count: '1', language: 'it', format: 'json' });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  const d = await r.json();
  const g = d.results?.[0];
  if (!g) throw new Error(`Non trovo il luogo "${name}".`);
  return { lat: g.latitude, lon: g.longitude, name: g.name };
}

function gps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

export async function locate(place) {
  if (place) return geocode(place);
  const cached = store.get('geo', null);
  if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return cached;
  const city = getSettings().city || 'Roma';
  const pos = await gps();
  const loc = pos ? { ...pos, name: city } : await geocode(city);
  store.set('geo', { ...loc, ts: Date.now() });
  return loc;
}

export async function getWeather(place) {
  const loc = await locate(place);
  const q = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon, timezone: 'auto', forecast_days: '3',
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  const d = await r.json();
  const days = ['oggi', 'domani', 'dopodomani'];
  return {
    luogo: loc.name,
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
    description: 'Meteo attuale e previsioni per 3 giorni. Senza luogo usa la posizione del tablet.',
    parameters: { type: 'OBJECT', properties: { luogo: S('STRING', 'Città, opzionale') } },
  },
  {
    name: 'cerca_sul_web',
    description: 'Cerca su Google informazioni aggiornate: notizie, risultati sportivi, fatti recenti, orari, prezzi. Usalo per tutto ciò che può essere cambiato dopo il tuo addestramento.',
    parameters: { type: 'OBJECT', properties: { domanda: S('STRING', 'Cosa cercare, in italiano') }, required: ['domanda'] },
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
      return w;
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

    async termina_conversazione() {
      ctx.endConversation();
      return { ok: true };
    },
  };
}
