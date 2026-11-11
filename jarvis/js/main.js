// Orchestrazione: parola di attivazione, conversazione, stati visivi, promemoria, HUD.
import { store, getSettings, saveSettings } from './store.js';
import { NeuralCore } from './neural.js';
import { Ears, Mouth } from './voice.js';
import { Brain, BrainError, logError } from './brain.js';
import { createHandlers, bindBrain, reminders, getWeather, weatherText } from './tools.js';
import { spotify, redirectUri } from './spotify.js';
import { seedMemories } from './seed.js';

seedMemories();

const $ = (id) => document.getElementById(id);
const JARVIS_VERSION = '1.3';

// Il riconoscimento vocale italiano a volte scrive "Jarvis" in modi creativi.
const WAKE = /\b(jarvis|jarvi|jarviss|giarvis|jervis|gervis|charvis|jarbis|giarvi|jar vis)\b/i;
const GOODBYE = /\b(ciao|arrivederci|a dopo|a più tardi|a presto|buonanotte|addio|alla prossima)\b/i;

const ACKS = ['Dimmi, Signore.', 'Sono tutto orecchi, Signore.', 'Eccomi, Signore.', 'Agli ordini, Signore.', 'Dica pure, Signore.'];
const BYES = ['A dopo, Signore.', 'Ciao Signore, io resto qui.', 'Quando vuoi, Signore.', 'Torno a sonnecchiare, Signore.'];
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const core = new NeuralCore($('core'));
function placeStatus() {
  const edge = core.bottomEdge();
  $('status').style.top = `${edge + 8}px`;
  // in verticale i pensieri compaiono sotto il nucleo, in orizzontale in alto
  $('thoughts').style.top = innerWidth < innerHeight ? `${edge + 34}px` : '';
}
placeStatus();
window.addEventListener('resize', placeStatus);

const state = {
  mode: 'off',            // off | sleep | listening | thinking | speaking
  conversation: false,    // true dopo "Jarvis", fino al saluto
  endAfterReply: false,
  busy: false,
  queue: [],              // annunci in attesa (es. promemoria scaduti mentre pensa)
};

// ---------- UI ----------

const STATUS = {
  off: 'SISTEMI OFFLINE',
  sleep: 'IN ATTESA · DI\' «JARVIS»',
  listening: 'TI ASCOLTO, SIGNORE',
  thinking: 'ELABORAZIONE',
  speaking: '',
};

function setMode(mode) {
  state.mode = mode;
  core.setState(mode);
  const el = $('status');
  el.textContent = STATUS[mode];
  el.classList.toggle('thinking', mode === 'thinking');
}

function sys(id, on, warn = false) {
  const el = $(id);
  el.classList.toggle('on', !!on && !warn);
  el.classList.toggle('warn', !!warn);
}

let typeTimer;
function showJarvis(text) {
  const el = $('sub-jarvis');
  clearInterval(typeTimer);
  el.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    el.scrollTop = el.scrollHeight; // mostra sempre l'ultima parte
    if (i >= text.length) clearInterval(typeTimer);
  }, 28);
}

function showUser(text) {
  $('sub-user').textContent = text ? `«${text}»` : '';
}

function tickClock() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  $('date').textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function refreshWeather() {
  try {
    const w = await getWeather();
    $('w-temp').textContent = `${w.adesso.temperatura}°`;
    $('w-desc').textContent = weatherText(w._code);
    $('w-place').textContent = `${w.luogo} · max ${w.previsioni[0].max}° min ${w.previsioni[0].min}°`;
  } catch {
    $('w-desc').textContent = 'non disponibile';
  }
}

function refreshReminders() {
  const n = reminders.all().length;
  $('rem-count').textContent = n ? `${n} promemoria attiv${n === 1 ? 'o' : 'i'}` : '';
}

async function refreshMusic() {
  sys('sys-spotify', spotify.isConnected());
  if (!spotify.isConnected()) { $('music').hidden = true; return; }
  try {
    const np = await spotify.nowPlaying();
    $('music').hidden = !np.brano;
    $('music-title').textContent = np.brano || '';
    $('music-artist').textContent = np.artista ? `${np.artista}${np.in_riproduzione ? '' : ' · in pausa'}` : '';
  } catch {
    $('music').hidden = true;
  }
}

// ---------- voce e udito ----------

const mouth = new Mouth({
  onStart: () => setMode('speaking'),
  onEnd: () => {},
});

// Ascolto paziente: i pezzi di frase vengono accumulati e spediti solo dopo una pausa vera,
// così il Signore può ragionare ad alta voce senza essere interrotto.
const heard = { text: '', timer: null };
function silenceMs() {
  if (!state.conversation) return 700;
  return brain.brainstorm ? 2600 : 1500;
}
function armSilence() {
  clearTimeout(heard.timer);
  heard.timer = setTimeout(() => {
    const t = heard.text.trim();
    heard.text = '';
    if (t) onHeard(t);
  }, silenceMs());
}

const ears = new Ears({
  onFinal: (t) => {
    if (state.busy) return;
    heard.text += ` ${t}`;
    if (state.conversation) showUser(heard.text.trim());
    armSilence();
  },
  onInterim: (t) => {
    if (state.busy) return;
    if (state.conversation) showUser(`${heard.text} ${t}`.trim());
    if (heard.text) armSilence(); // sta ancora parlando: aspetta
  },
  onActive: (on) => sys('sys-ears', on || ears.wanted),
  onError: (kind) => {
    if (kind === 'microfono-negato') {
      sys('sys-ears', false);
      showJarvis('Non ho il permesso di usare il microfono, Signore. Consentilo nelle impostazioni del browser e ricarica la pagina.');
    }
  },
});

const handlers = createHandlers({
  onRemindersChanged: refreshReminders,
  onSpotifyChanged: () => setTimeout(refreshMusic, 1200),
  endConversation: () => { state.endAfterReply = true; },
  onBrainstormChanged: () => refreshBoard(),
});
const brain = new Brain(handlers);
bindBrain(brain);

async function say(text) {
  showJarvis(text);
  ears.stop(); // non deve sentire se stesso (soprattutto con l'Alexa come cassa)
  await mouth.speak(text);
}

function listenAgain() {
  if (state.mode === 'off') return;
  setMode(state.conversation ? 'listening' : 'sleep');
  ears.start();
}

function startConversation() {
  state.conversation = true;
  spotify.duck();
}

function endConversation() {
  state.conversation = false;
  state.endAfterReply = false;
  spotify.unduck();
  if (brain.brainstorm) { brain.setBrainstorm(''); refreshBoard(); } // le idee restano salvate
  brain.reflect(); // scrive il diario e impara cose nuove, in background
}

// ---------- logica principale ----------

function onHeard(raw) {
  if (state.busy) return;
  const text = raw.trim();
  if (!text) return;

  if (!state.conversation) {
    const m = text.match(WAKE);
    if (!m) return;
    startConversation();
    const rest = text.slice(m.index + m[0].length).replace(/^[\s,.!?:;]+/, '').trim();
    const before = text.slice(0, m.index).trim();
    // "ciao jarvis" da solo = saluto di attivazione, non congedo
    if (rest.length < 3) {
      showUser(text);
      run(async () => { await say(pick(ACKS)); });
      return;
    }
    handle(before && !GOODBYE.test(before) ? text : rest);
    return;
  }

  // in conversazione: "ok ciao Jarvis", "a dopo Jarvis", ecc. chiudono subito
  if (GOODBYE.test(text) && WAKE.test(text) && text.split(/\s+/).length <= 6) {
    showUser(text);
    run(async () => {
      await say(pick(BYES));
      endConversation();
    });
    return;
  }
  handle(text);
}

async function run(task) {
  state.busy = true;
  ears.stop();
  try {
    await task();
  } finally {
    state.busy = false;
    await flushQueue();
    listenAgain();
  }
}

function handle(text) {
  showUser(text);
  run(async () => {
    setMode('thinking');
    core.burst(40);
    let reply;
    clearThoughts();
    try {
      reply = await brain.ask(text, {
        onTool: (name) => { core.burst(25); addThought(TOOL_LABELS[name] || name); },
        onThought: (t) => { core.burst(15); addThought(t); },
      });
    } catch (e) {
      reply = errorMessage(e);
    }
    sys('sys-brain', !!getSettings().geminiKey);
    fadeThoughts();
    await say(reply || 'Uhm. Ho perso il filo, Signore.');
    if (state.endAfterReply) endConversation();
  });
}

function errorMessage(e) {
  if (!(e instanceof BrainError)) { logError(`js: ${e && e.stack ? e.stack.slice(0, 400) : e}`); return `Qualcosa si è rotto nei miei circuiti, Signore: ${e.message}`; }
  switch (e.kind) {
    case 'no-key': openSettings(); return 'Signore, mi manca il cervello: incolla la chiave Gemini nelle impostazioni.';
    case 'bad-key': sys('sys-brain', false, true); return 'La chiave Gemini non funziona, Signore. Controllala nelle impostazioni.';
    case 'quota': return 'Ho finito le richieste gratuite per questo minuto, Signore. Dammi qualche secondo e riprova.';
    case 'timeout': return 'Il mio cervello remoto non risponde in questo momento, Signore. Riprova tra poco.';
    case 'overloaded': return 'I server di Google sono sovraccarichi, Signore. Riprova tra poco.';
    case 'network': return 'Non riesco a raggiungere la rete, Signore. Controlla il Wi-Fi.';
    default: return 'Il mio cervello remoto ha avuto un singhiozzo, Signore. Riprova.';
  }
}

// ---------- pensieri visibili ----------

const TOOL_LABELS = {
  meteo: 'consulto il meteo', cerca_sul_web: 'cerco sul web', data_ora: 'guardo l\'orologio',
  crea_promemoria: 'annoto un promemoria', elenca_promemoria: 'controllo i promemoria',
  cancella_promemoria: 'cancello promemoria', lista_aggiungi: 'aggiorno la lista',
  lista_leggi: 'leggo la lista', lista_rimuovi: 'aggiorno la lista', ricorda: 'me lo segno in memoria',
  dimentica: 'dimentico', spotify_riproduci: 'cerco su Spotify', spotify_comando: 'comando Spotify',
  spotify_cosa_suona: 'ascolto cosa suona', brainstorming: 'preparo la lavagna',
  salva_idea: 'salvo l\'idea', leggi_idee: 'rileggo le idee', termina_conversazione: 'chiudo',
};

// I "riassunti dei pensieri" di Gemini hanno spesso un titolo in grassetto: mostriamo quello.
function thoughtHeadline(t) {
  const bold = t.match(/\*\*(.+?)\*\*/);
  const line = (bold ? bold[1] : t.split('\n').find((l) => l.trim()) || '').replace(/[*#_`]/g, '').trim();
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

function addThought(t) {
  const h = thoughtHeadline(t);
  if (!h) return;
  const box = $('thoughts');
  const last = box.lastElementChild;
  if (last && last.textContent === h) return;
  const el = document.createElement('div');
  el.className = 'thought';
  el.textContent = h;
  box.append(el);
  while (box.children.length > 4) box.firstElementChild.remove();
}

function clearThoughts() { $('thoughts').innerHTML = ''; $('thoughts').classList.remove('fade'); }
function fadeThoughts() { $('thoughts').classList.add('fade'); }

// ---------- lavagna del brainstorming ----------

function refreshBoard() {
  const topic = brain.brainstorm;
  $('board').hidden = !topic;
  STATUS.listening = topic ? 'BRAINSTORMING · TI ASCOLTO' : 'TI ASCOLTO, SIGNORE';
  if (state.mode === 'listening') setMode('listening');
  if (!topic) return;
  $('board-topic').textContent = topic;
  const ideas = (store.get('boards', {})[topic] || []).slice(-7);
  const ul = $('board-ideas');
  ul.innerHTML = '';
  ideas.forEach((i) => { const li = document.createElement('li'); li.textContent = i; ul.append(li); });
  if (!ideas.length) ul.innerHTML = '<li class="empty">Ancora nessuna idea. Spara.</li>';
}

// ---------- promemoria ----------

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.22);
    });
    setTimeout(() => ac.close(), 1200);
  } catch { /* ignore */ }
}

function checkReminders() {
  const due = reminders.due();
  if (!due.length) return;
  due.forEach((r) => {
    reminders.remove(r.id);
    const late = Date.now() - r.due > 5 * 60000;
    state.queue.push(late ? `Signore, mentre ero spento è scaduto un promemoria: ${r.text}` : `Signore, ti ricordo: ${r.text}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Jarvis', { body: r.text }); } catch { /* ignore */ }
    }
  });
  refreshReminders();
  if (!state.busy && state.mode !== 'off') run(async () => {});
}

async function flushQueue() {
  while (state.queue.length && state.mode !== 'off') {
    const msg = state.queue.shift();
    beep();
    await new Promise((r) => setTimeout(r, 800));
    await say(msg);
  }
}

// ---------- tocchi sullo schermo ----------

$('core').addEventListener('click', (ev) => {
  if (state.mode === 'off') return;
  const c = core.center;
  if (!c || Math.hypot(ev.clientX - c.x, ev.clientY - c.y) > c.r) return;
  if (state.mode === 'speaking') {
    mouth.cancel(); // interrompe Jarvis mentre parla
    return;
  }
  if (!state.conversation && !state.busy) {
    startConversation();
    run(async () => { await say(pick(ACKS)); });
  }
});

$('btn-keyboard').addEventListener('click', () => {
  const f = $('typer');
  f.hidden = !f.hidden;
  if (!f.hidden) $('typer-input').focus();
});

$('typer').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = $('typer-input').value.trim();
  if (!v || state.busy) return;
  $('typer-input').value = '';
  $('typer').hidden = true;
  if (!state.conversation) startConversation();
  handle(v);
});

// ---------- impostazioni ----------

function fillVoices() {
  const sel = $('s-voice');
  const voices = mouth.italianVoices();
  const { voiceName } = getSettings();
  sel.innerHTML = '';
  if (!voices.length) sel.add(new Option('Voce di sistema', ''));
  voices.forEach((v) => sel.add(new Option(`${v.name}${v.localService ? '' : ' (online)'}`, v.name, false, v.name === voiceName)));
}

function fillMemories() {
  const ul = $('s-memories');
  const mem = store.get('memories', []);
  ul.innerHTML = '';
  if (!mem.length) {
    ul.innerHTML = '<li><span class="help">Ancora niente. Raccontagli di te.</span></li>';
    return;
  }
  mem.forEach((m, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = m;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.onclick = () => {
      const cur = store.get('memories', []);
      cur.splice(i, 1);
      store.set('memories', cur);
      fillMemories();
    };
    li.append(span, del);
    ul.append(li);
  });
}

function fillDiag() {
  const m = store.get('models', null);
  const errs = store.get('errors', []);
  $('s-diag').textContent = [
    `Versione: ${JARVIS_VERSION}`,
    `Chiave Gemini: ${getSettings().geminiKey ? 'presente' : 'assente'}`,
    `Modelli: ${m ? `${m.fast}${m.proven ? ' (verificato)' : ''} / ${m.deep}` : 'non ancora scoperti'}`,
    `Spotify: ${spotify.isConnected() ? 'collegato' : 'non collegato'} · redirect: ${redirectUri()}`,
    `Udito: ${ears.supported ? 'supportato' : 'NON supportato'} · Voci italiane: ${mouth.italianVoices().length}`,
    '',
    errs.length ? 'Ultimi errori:' : 'Nessun errore registrato.',
    ...errs.map((e) => `${e.t}  ${e.text}`),
  ].join('\n');
}

function openSettings() {
  const s = getSettings();
  $('s-key').value = s.geminiKey;
  $('s-model').value = s.geminiModel;
  $('s-rate').value = s.rate;
  $('s-pitch').value = s.pitch;
  $('s-rate-v').textContent = s.rate;
  $('s-pitch-v').textContent = s.pitch;
  $('s-city').value = s.city;
  $('s-spotify').value = s.spotifyClientId;
  $('s-redirect').textContent = redirectUri();
  $('s-spotify-status').textContent = spotify.isConnected() ? 'Collegato ✓' : 'Non collegato';
  $('s-spotify-connect').textContent = spotify.isConnected() ? 'Scollega' : 'Collega Spotify';
  fillVoices();
  fillMemories();
  fillDiag();
  if (!$('settings').open) $('settings').showModal();
}

function readSettingsForm() {
  return {
    geminiKey: $('s-key').value.trim(),
    geminiModel: $('s-model').value.trim(),
    voiceName: $('s-voice').value,
    rate: Number($('s-rate').value),
    pitch: Number($('s-pitch').value),
    city: $('s-city').value.trim() || 'Roma',
    spotifyClientId: $('s-spotify').value.trim(),
  };
}

$('btn-settings').addEventListener('click', openSettings);
$('s-rate').addEventListener('input', (e) => { $('s-rate-v').textContent = e.target.value; });
$('s-pitch').addEventListener('input', (e) => { $('s-pitch-v').textContent = e.target.value; });

$('s-test').addEventListener('click', () => {
  // prova con i valori del modulo senza salvarli davvero
  const prev = getSettings();
  saveSettings(readSettingsForm());
  ears.stop();
  const done = mouth.speak('Ciao Signore. Questa è la mia voce. Spero ti piaccia, perché è l\'unica che ho.');
  store.set('settings', prev);
  done.then(() => { if (state.mode !== 'off' && !state.busy) listenAgain(); });
});

$('s-spotify-connect').addEventListener('click', async () => {
  if (spotify.isConnected()) {
    spotify.disconnect();
    openSettings();
    refreshMusic();
    return;
  }
  saveSettings(readSettingsForm());
  try {
    await spotify.connect();
  } catch (e) {
    $('s-spotify-status').textContent = e.message;
  }
});

$('s-test-brain').addEventListener('click', async () => {
  saveSettings(readSettingsForm());
  const btn = $('s-test-brain');
  btn.textContent = 'Provo…'; btn.disabled = true;
  try {
    store.remove('models');
    const m = await brain.warmup();
    const t0 = Date.now();
    const reply = await brain.ask('Prova tecnica: rispondi solo "Cervello operativo, Signore."');
    $('s-test-result').textContent = `OK in ${((Date.now() - t0) / 1000).toFixed(1)}s con ${m.fast}: ${reply}`;
    sys('sys-brain', true);
  } catch (e) {
    $('s-test-result').textContent = `ERRORE: ${e.kind || ''} ${e.message || e}`;
    sys('sys-brain', false, true);
  }
  btn.textContent = 'Prova il cervello'; btn.disabled = false;
  fillDiag();
});

$('s-clear-errors').addEventListener('click', () => { store.remove('errors'); fillDiag(); });

$('s-reset-chat').addEventListener('click', () => {
  brain.reset();
  $('s-reset-chat').textContent = 'Fatto ✓';
  setTimeout(() => { $('s-reset-chat').textContent = 'Dimentica la conversazione'; }, 1500);
});

$('settings').addEventListener('close', () => {
  if ($('settings').returnValue !== 'save') return;
  const before = getSettings().city;
  saveSettings(readSettingsForm());
  sys('sys-brain', !!getSettings().geminiKey);
  if (getSettings().geminiKey) { store.remove('models'); brain.warmup().then(() => sys('sys-brain', true)).catch(() => sys('sys-brain', false, true)); }
  if (before !== getSettings().city) {
    store.remove('geo');
    refreshWeather();
  }
});

// ---------- avvio ----------

let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.mode !== 'off') {
    keepAwake();
    refreshWeather();
    refreshMusic();
    if (!state.busy) listenAgain();
  }
});

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Sistemi online. Ancora sveglio, Signore? Non la giudico. Quasi.';
  if (h < 13) return 'Sistemi online. Buongiorno, Signore.';
  if (h < 18) return 'Sistemi online. Buon pomeriggio, Signore.';
  return 'Sistemi online. Buonasera, Signore.';
}

async function boot() {
  $('boot').classList.add('gone');
  try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  keepAwake();
  setMode('thinking');
  core.burst(120);

  sys('sys-voice', !!window.speechSynthesis);
  sys('sys-brain', !!getSettings().geminiKey);
  if (getSettings().geminiKey) brain.warmup().then(() => sys('sys-brain', true)).catch(() => sys('sys-brain', false, true));

  if (!ears.supported) {
    showJarvis('Questo browser non supporta il riconoscimento vocale. Usa Google Chrome sul tablet, Signore.');
  }

  await new Promise((r) => setTimeout(r, 1400));
  state.busy = true;
  await say(getSettings().geminiKey ? greeting() : 'Sistemi online, Signore. Mi manca solo il cervello: incolla la chiave Gemini nelle impostazioni.');
  state.busy = false;
  if (!getSettings().geminiKey) openSettings();
  await flushQueue();
  listenAgain();
}

$('btn-boot').addEventListener('click', boot);

(async function init() {
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(checkReminders, 1000);
  setInterval(refreshWeather, 15 * 60 * 1000);
  setInterval(refreshMusic, 30 * 1000);
  refreshReminders();
  refreshWeather();
  refreshBoard();

  const sp = await spotify.handleRedirect().catch((e) => ({ ok: false, error: e.message }));
  if (sp && !sp.ok) showJarvis(`Il collegamento con Spotify non è riuscito: ${sp.error}`);
  if (sp && sp.ok) showJarvis('Spotify collegato, Signore. Tocca ATTIVA e chiedimi un po\' di musica.');
  refreshMusic();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
