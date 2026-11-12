// Orchestrazione: parola di attivazione, conversazione, stati visivi, promemoria, HUD.
import { store, getSettings, saveSettings } from './store.js';
import { NeuralCore } from './neural.js';
import { Ears, Mouth } from './voice.js';
import { Brain, BrainError, logError } from './brain.js';
import { createHandlers, bindBrain, reminders, getWeather, weatherText, locate, knownLocation } from './tools.js';
import { spotify, redirectUri } from './spotify.js';
import { seedMemories } from './seed.js';
import { IOS, IOS_OTHER_BROWSER, STANDALONE, deviceName } from './platform.js';

seedMemories();

// Link di configurazione: aprendo .../jarvis/#chiave=XXXX la chiave Gemini viene salvata da sola
// (e subito tolta dall'indirizzo). Serve a non doverla incollare a mano in ogni browser.
let keyImported = false;
(function importKeyFromLink() {
  const m = location.hash.match(/^#chiave=(.+)$/);
  if (!m) return;
  const key = decodeURIComponent(m[1]).replace(/[\s"']/g, '');
  if (key) {
    saveSettings({ geminiKey: key });
    store.remove('models');
    store.remove('cooldowns');
    keyImported = true;
  }
  history.replaceState(null, '', location.pathname + location.search);
})();

const $ = (id) => document.getElementById(id);
const JARVIS_VERSION = '3.1';

// Il riconoscimento vocale italiano a volte scrive "Jarvis" in modi creativi: si accettano
// le storpiature note, quelle a una lettera di distanza e le parole aggiunte nelle impostazioni.
const WAKE_KNOWN = ['jarvis', 'jarvi', 'jarviss', 'giarvis', 'jervis', 'gervis', 'charvis', 'jarbis', 'giarvi', 'javis', 'djarvis', 'yarvis', 'iarvis', 'jarves', 'jarvish', 'jarvys', 'travis', 'giarvìs', 'jarvis\'s'];
const GOODBYE = /\b(ciao|arrivederci|a dopo|a più tardi|a presto|buonanotte|addio|alla prossima)\b/i;
const GOODNIGHT = /\b(buonanotte|buona notte|vai a dormire|vai a nanna|dormi)\b/i;

function lev1(a, b) {
  // vero se a e b differiscono al massimo di una lettera (sostituita, in più o in meno)
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Cerca la parola di attivazione: restituisce { index, length } oppure null.
function findWake(text) {
  const extra = (getSettings().wakeWords || '').toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  for (const phrase of ['jar vis', 'giar vis', ...extra.filter((w) => w.includes(' '))]) {
    const at = lower.indexOf(phrase);
    if (at >= 0) return { index: at, length: phrase.length };
  }
  const words = [...WAKE_KNOWN, ...extra];
  const re = /[\p{L}']+/gu;
  let m;
  while ((m = re.exec(lower))) {
    const w = m[0];
    if (words.includes(w) || (w.length >= 5 && w.length <= 7 && lev1(w, 'jarvis'))) return { index: m.index, length: w.length };
  }
  return null;
}

const ACKS = ['Dimmi, Signore.', 'Sono tutto orecchi, Signore.', 'Eccomi, Signore.', 'Agli ordini, Signore.', 'Dica pure, Signore.'];
const BYES = ['A dopo, Signore.', 'Ciao Signore, io resto qui.', 'Quando vuoi, Signore.', 'Torno a sonnecchiare, Signore.'];
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const core = new NeuralCore($('core'));
function placeStatus() {
  const edge = core.bottomEdge();
  $('status').style.top = `${edge + 8}px`;
  $('mic-state').style.top = `${edge + 30}px`;
  // in verticale i pensieri compaiono sotto il nucleo, in orizzontale in alto
  $('thoughts').style.top = innerWidth < innerHeight ? `${edge + 56}px` : '';
}
placeStatus();
window.addEventListener('resize', placeStatus);

const state = {
  mode: 'off',            // off | sleep | listening | thinking | speaking
  conversation: false,    // true dopo "Jarvis", fino al saluto
  endAfterReply: false,
  busy: false,
  queue: [],              // annunci in attesa (es. promemoria scaduti mentre pensa)
  rest: false,            // modalità notte: schermo scuro, ascolto spento
  restAfterReply: false,
  lastHeard: '',
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
  document.body.classList.toggle('is-off', mode === 'off');
  refreshMic();
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
  $('rest-clock').textContent = $('clock').textContent;
  $('date').textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function refreshWeather() {
  try {
    const w = await getWeather();
    $('w-temp').textContent = `${w.adesso.temperatura}°`;
    $('w-desc').textContent = weatherText(w._code);
    // "≈" = posizione stimata dalla rete, non dal GPS
    $('w-place').textContent = `${w._source === 'rete' ? '≈ ' : ''}${w.luogo} · max ${w.previsioni[0].max}° min ${w.previsioni[0].min}°`;
  } catch (e) {
    $('w-desc').textContent = 'non disponibile';
    $('w-place').textContent = '';
    logError(`meteo: ${e && e.message ? e.message : e}`);
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
mouth.onProblem = (text) => { logError(`voce: ${text}`); sys('sys-voice', true, true); };
// il primo tocco sullo schermo sblocca la voce (necessario su iPhone)
document.addEventListener('pointerdown', () => {
  mouth.unlock();
  // se lo schermo non è ancora "sempre acceso" (per esempio dopo un rifiuto momentaneo), riprova a ogni tocco
  if (state.mode !== 'off' && !/^attivo/.test(screenAwake)) keepAwake();
}, { capture: true });

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

let heardHint;
const ears = new Ears({
  onFinal: (t) => {
    if (state.busy) return;
    state.lastHeard = t;
    heard.text += ` ${t}`;
    if (state.conversation) {
      showUser(heard.text.trim());
    } else {
      // in attesa: mostra cosa ha capito, così si vede come il tablet trascrive "Jarvis"
      $('sub-user').textContent = `ho sentito: «${t}»`;
      clearTimeout(heardHint);
      heardHint = setTimeout(() => { if (!state.conversation && !state.busy) $('sub-user').textContent = ''; }, 4000);
    }
    armSilence();
  },
  onInterim: (t) => {
    if (state.busy) return;
    if (state.conversation) showUser(`${heard.text} ${t}`.trim());
    if (heard.text) armSilence(); // sta ancora parlando: aspetta
  },
  onActive: (on) => { sys('sys-ears', on || ears.wanted); refreshMic(); },
  onError: (kind) => {
    logError(`udito: ${kind}`);
    if (kind === 'microfono-negato') {
      sys('sys-ears', false);
      showJarvis(IOS
        ? 'Non ho il permesso di usare il microfono, Signore. Vai in Impostazioni, Safari, Microfono e scegli Consenti; controlla anche che Siri e Dettatura siano attivi. Poi ricarica la pagina.'
        : 'Non ho il permesso di usare il microfono, Signore. Consentilo nelle impostazioni del browser e ricarica la pagina.');
    } else if (kind === 'serve-un-tocco') {
      // Safari non lascia riaccendere il microfono da solo: basta un tocco
      needTapUI();
      sys('sys-ears', true, true);
    } else {
      sys('sys-ears', true, true); // giallo: microfono occupato da un'altra app, o riconoscimento senza rete
    }
  },
});

const handlers = createHandlers({
  onRemindersChanged: refreshReminders,
  onSpotifyChanged: () => setTimeout(refreshMusic, 1200),
  endConversation: () => { state.endAfterReply = true; },
  onBrainstormChanged: () => refreshBoard(),
  onLocationChanged: () => refreshWeather(),
  rest: () => { state.restAfterReply = true; },
});
const brain = new Brain(handlers);
bindBrain(brain);

async function say(text) {
  showJarvis(text);
  // non deve sentire se stesso, e deve aspettare che il microfono sia libero prima di parlare
  const wasListening = ears.running;
  await ears.stop();
  if (wasListening) await new Promise((r) => setTimeout(r, 200)); // Android restituisce l'audio con un attimo di ritardo
  try {
    await mouth.speak(text);
  } catch (e) {
    logError(`voce: ${e && e.message ? e.message : e}`);
  }
}

function listenAgain() {
  if (state.mode === 'off') return;
  if (state.rest) { setMode('sleep'); return; } // di notte non ascolta
  setMode(state.conversation ? 'listening' : 'sleep');
  if (ears.needsTap) { needTapUI(); return; } // Safari: aspetta il tocco
  ears.start();
}

// Indicatore sempre visibile: dice se il microfono è acceso, e se no cosa fare.
let micTimer;
function refreshMic() {
  clearTimeout(micTimer);
  // piccolo ritardo: tra una frase e l'altra il microfono si riaccende da solo, non deve lampeggiare
  micTimer = setTimeout(() => {
    const el = $('mic-state');
    const speakingOrThinking = state.mode === 'speaking' || state.mode === 'thinking';
    el.hidden = state.mode === 'off' || state.rest || speakingOrThinking;
    if (el.hidden) return;
    let text; let off = true;
    if (!ears.supported) text = IOS ? 'microfono non disponibile qui: aprimi con Safari, o scrivimi con ⌨' : 'microfono non disponibile: aprimi con Chrome, o scrivimi con ⌨';
    else if (ears.fatal) text = 'microfono non consentito: dai il permesso al browser';
    else if (ears.needsTap) text = 'microfono in pausa: tocca «Tocca per parlare»';
    else if (ears.running || ears.wanted) { text = 'microfono acceso'; off = false; }
    else text = 'microfono spento: tocca il cerchio al centro';
    el.textContent = text;
    el.classList.toggle('off', off);
  }, 500);
}

function needTapUI() {
  $('btn-talk').hidden = false;
  if (state.mode === 'listening' || state.mode === 'sleep') $('status').textContent = 'MICROFONO IN PAUSA';
}

// Tocco per parlare (serve su iPhone/iPad quando Safari non riaccende il microfono da solo).
function talkFromTap() {
  $('btn-talk').hidden = true;
  ears.needsTap = false;
  ears.start(); // dentro il tocco
  if (!state.conversation) startConversation();
  setMode('listening');
}

// ---------- modalità notte ----------

function enterRest() {
  if (state.conversation) endConversation();
  state.rest = true;
  state.restAfterReply = false;
  ears.stop();
  $('btn-talk').hidden = true;
  $('rest').hidden = false;
  document.body.classList.add('is-rest');
  setMode('sleep');
}

function exitRest() {
  state.rest = false;
  $('rest').hidden = true;
  document.body.classList.remove('is-rest');
  refreshMic();
  if (state.busy) return;
  startConversation();
  run(async () => { await say(pick(['Eccomi, Signore.', 'Sono sveglio, Signore.', 'Bentornato, Signore.'])); });
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
    const m = findWake(text);
    if (!m) return;
    startConversation();
    const rest = text.slice(m.index + m.length).replace(/^[\s,.!?:;]+/, '').trim();
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
  if ((GOODBYE.test(text) || GOODNIGHT.test(text)) && findWake(text) && text.split(/\s+/).length <= 6) {
    showUser(text);
    const night = GOODNIGHT.test(text);
    run(async () => {
      await say(night ? 'Buonanotte, Signore. Tocca lo schermo quando mi vuoi.' : pick(BYES));
      endConversation();
      if (night) enterRest();
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
    if (state.restAfterReply) enterRest();
    else if (state.endAfterReply) endConversation();
  });
}

function errorMessage(e) {
  if (!(e instanceof BrainError)) { logError(`js: ${e && e.stack ? e.stack.slice(0, 400) : e}`); return `Qualcosa si è rotto nei miei circuiti, Signore: ${e.message}`; }
  switch (e.kind) {
    case 'no-key': openSettings(); return 'Signore, mi manca il cervello: incolla la chiave Gemini nelle impostazioni.';
    case 'bad-key': sys('sys-brain', false, true); return 'La chiave Gemini non funziona, Signore. Controllala nelle impostazioni.';
    case 'quota': return e.daily
      ? 'Ho finito tutte le richieste gratuite di oggi, Signore. Google me ne ridà domani.'
      : 'Sto facendo troppe richieste al minuto per il piano gratuito, Signore. Dammi qualche secondo e riprova.';
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
  dove_sono: 'controllo dove mi trovo', imposta_citta: 'aggiorno la posizione', vai_a_riposo: 'mi metto a riposo',
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

// Un solo "altoparlante" per i suoni, creato dentro il tocco su ATTIVA:
// su iPhone e iPad un suono creato più tardi resterebbe muto.
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* ignore */ }
}

function beep() {
  try {
    unlockAudio();
    const ac = audioCtx;
    if (!ac) return;
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
  if (state.busy) return;
  if (ears.needsTap || IOS) { talkFromTap(); return; } // Apple: niente frase di cortesia, si ascolta subito
  if (!state.conversation) {
    startConversation();
    run(async () => { await say(pick(ACKS)); });
  }
});
$('btn-talk').addEventListener('click', () => { if (!state.busy && state.mode !== 'off') talkFromTap(); });

$('btn-rest').addEventListener('click', () => { if (state.mode !== 'off' && !state.busy) enterRest(); });
$('rest').addEventListener('click', exitRest);

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
    del.setAttribute('aria-label', 'Dimentica');
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
  const geo = knownLocation();
  $('s-diag').textContent = [
    `Versione: ${JARVIS_VERSION}`,
    `Chiave Gemini: ${getSettings().geminiKey ? 'presente' : 'assente'}`,
    `Modello in uso: ${brain.lastModel || (m ? brain.chain()[0] : 'non ancora scelto')}`,
    `Modelli a riposo: ${Object.entries(brain.cooldowns()).map(([k, v]) => `${k} (${v.why}, fino alle ${new Date(v.until).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})`).join('; ') || 'nessuno'}`,
    `Spotify: ${spotify.isConnected() ? 'collegato' : 'non collegato'} · redirect: ${redirectUri()}`,
    `Dispositivo: ${deviceName()}${STANDALONE ? ', aperto dall\'icona' : ', aperto nel browser'} · Schermo sempre acceso: ${screenAwake}`,
    `Udito: ${ears.supported ? 'supportato' : 'NON supportato'}${ears.needsTap ? ' (serve un tocco per parlare)' : ''} · Voci italiane: ${mouth.italianVoices().length}`,
    `Voce: ${!window.speechSynthesis ? 'NON disponibile in questo browser' : mouth.lastProblem ? `PROBLEMA: ${mouth.lastProblem}` : 'nessun problema rilevato'}`,
    `Memoria: ${brain.remembered()} scambi ricordati parola per parola${brain.summary ? ' + riassunto dei precedenti' : ''}, ${store.get('memories', []).length} ricordi su di te, ${store.get('diary', []).length} pagine di diario · ${storagePersistent === true ? 'protetta' : storagePersistent === false ? 'non ancora garantita da Chrome: per proteggerla installa Jarvis sulla schermata Home' : 'protezione non verificabile'}`,
    `Posizione: ${geo ? `${geo.name}${geo.region ? `, ${geo.region}` : ''} (${geo.source === 'gps' ? 'GPS' : geo.source === 'manuale' ? 'scritta a mano' : 'stimata dalla rete'})` : 'non ancora rilevata'}`,
    `Ultima frase sentita: ${state.lastHeard || '(niente)'}`,
    `Batteria: ${body.battery ? `${Math.round(body.battery.level * 100)}%${body.battery.charging ? ' in carica' : ''}` : 'non leggibile'}`,
    '',
    errs.length ? 'Ultimi errori:' : 'Nessun errore registrato.',
    ...errs.map((e) => `${e.t}  ${e.text}`),
  ].join('\n');
}

let settingsBefore = null;
function openSettings() {
  const s = getSettings();
  if (!$('settings').open) settingsBefore = s;
  $('s-key').value = s.geminiKey;
  $('s-model').value = s.geminiModel;
  $('s-rate').value = s.rate;
  $('s-pitch').value = s.pitch;
  $('s-rate-v').textContent = s.rate;
  $('s-pitch-v').textContent = s.pitch;
  $('s-city').value = s.place;
  $('s-wake').value = s.wakeWords;
  const geo = knownLocation();
  $('s-geo').textContent = geo ? `Adesso mi risulta: ${geo.name}${geo.region ? `, ${geo.region}` : ''} (${geo.source === 'gps' ? 'dal GPS' : geo.source === 'manuale' ? 'scritta da te' : 'stimata dalla rete, può essere sbagliata'})` : 'Posizione non ancora rilevata.';
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
    geminiKey: $('s-key').value.replace(/[\s"']/g, ''),
    geminiModel: $('s-model').value.trim(),
    voiceName: $('s-voice').value,
    rate: Number($('s-rate').value),
    pitch: Number($('s-pitch').value),
    place: $('s-city').value.trim(),
    wakeWords: $('s-wake').value.trim(),
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
    const r = await brain.selfTest();
    $('s-test-result').textContent = `OK in ${r.secs.toFixed(1)}s con ${r.model}: ${r.text}`;
    sys('sys-brain', true);
  } catch (e) {
    $('s-test-result').textContent = `ERRORE: ${e.kind || ''} ${e.message || e}`;
    sys('sys-brain', false, true);
  }
  btn.textContent = 'Prova il cervello'; btn.disabled = false;
  fillDiag();
});

$('s-locate').addEventListener('click', async () => {
  saveSettings({ place: $('s-city').value.trim() });
  $('s-geo').textContent = 'Rilevo la posizione…';
  try {
    store.remove('geo');
    const geo = await locate(null, { force: true });
    $('s-geo').textContent = `Adesso mi risulta: ${geo.name}${geo.region ? `, ${geo.region}` : ''} (${geo.source === 'gps' ? 'dal GPS' : geo.source === 'manuale' ? 'scritta da te' : 'stimata dalla rete: consenti la posizione a Chrome per quella precisa'})`;
    refreshWeather();
  } catch (e) {
    $('s-geo').textContent = e.message;
  }
  fillDiag();
});

$('s-clear-errors').addEventListener('click', () => { store.remove('errors'); fillDiag(); });

$('s-reset-chat').addEventListener('click', () => {
  brain.reset();
  $('s-reset-chat').textContent = 'Fatto ✓';
  setTimeout(() => { $('s-reset-chat').textContent = 'Dimentica la conversazione'; }, 1500);
});

// Le impostazioni si salvano mentre si scrive: non c'è modo di perderle chiudendo la finestra.
$('settings').addEventListener('input', () => { if ($('settings').open) saveSettings(readSettingsForm()); });
$('settings').addEventListener('change', () => { if ($('settings').open) saveSettings(readSettingsForm()); });

$('settings').addEventListener('close', () => {
  const before = settingsBefore || getSettings();
  saveSettings(readSettingsForm());
  const now = getSettings();
  sys('sys-brain', !!now.geminiKey);
  if (now.geminiKey && (now.geminiKey !== before.geminiKey || now.geminiModel !== before.geminiModel)) {
    store.remove('models');
    store.remove('cooldowns'); // chiave nuova = quote nuove
    brain.warmup().then(() => sys('sys-brain', true)).catch(() => sys('sys-brain', false, true));
  }
  if (before.place !== now.place) {
    store.remove('geo');
    refreshWeather();
  }
});

// ---------- il corpo: batteria e rete ----------

const body = { battery: null, lowWarned: false };
function refreshBody() {
  const b = body.battery;
  $('body-info').textContent = b ? `Batteria ${Math.round(b.level * 100)}%${b.charging ? ' ⚡' : ''}` : '';
  if (!b) return;
  if (b.charging) { body.lowWarned = false; return; }
  if (b.level <= 0.15 && !body.lowWarned && state.mode !== 'off') {
    body.lowWarned = true;
    state.queue.push(`Signore, la mia batteria è al ${Math.round(b.level * 100)} per cento. Mettimi in carica, o tra poco mi spengo.`);
    if (!state.busy) run(async () => {});
  }
}
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    body.battery = b;
    b.addEventListener('levelchange', refreshBody);
    b.addEventListener('chargingchange', refreshBody);
    refreshBody();
  // chiede a Chrome di non cancellare mai la memoria di Jarvis (chiave, ricordi, diario)
  try { navigator.storage?.persist?.().then((ok) => { storagePersistent = ok; }); } catch { /* ignore */ }
  }).catch(() => {});
}
brain.extraContext = () => {
  const b = body.battery;
  const parts = [];
  if (b) parts.push(`batteria al ${Math.round(b.level * 100)} per cento, ${b.charging ? 'in carica' : 'non in carica'}`);
  parts.push(navigator.onLine ? 'connesso a internet' : 'senza connessione');
  return `Il tuo corpo (il tablet): ${parts.join(', ')}.`;
};
window.addEventListener('online', () => { if (state.mode !== 'off') { refreshWeather(); } });

// ---------- sempre aggiornato ----------
// All'apertura Jarvis carica sempre l'ultima versione. Se resta acceso per giorni,
// controlla ogni mezz'ora: quando ne esce una nuova lo dice e basta un tocco per installarla.

let updateAnnounced = false;
async function checkForUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { version } = await r.json();
    if (!version || version === JARVIS_VERSION) return 'aggiornato';
    let already = null;
    try { already = sessionStorage.getItem('jarvis.reloadedFor'); } catch { /* ignore */ }
    if (state.mode === 'off' && already !== version) { // spento: si aggiorna da solo, una volta sola
      try { sessionStorage.setItem('jarvis.reloadedFor', version); } catch { /* ignore */ }
      location.reload();
      return 'ricarico';
    }
    $('btn-update').hidden = false;
    $('btn-update').textContent = `AGGIORNAMENTO ${version} PRONTO · TOCCA`;
    if (!updateAnnounced && !state.rest) {
      updateAnnounced = true;
      state.queue.push('Signore, è pronto un mio aggiornamento. Tocca la scritta in alto quando vuoi installarlo.');
      if (!state.busy) run(async () => {});
    }
    return version;
  } catch {
    return 'errore'; // senza rete riproverà
  }
}
$('btn-update').addEventListener('click', () => {
  try { sessionStorage.setItem('jarvis.justUpdated', '1'); } catch { /* ignore */ }
  location.reload();
});
$('s-update').addEventListener('click', async () => {
  $('s-test-result').textContent = 'Controllo…';
  const r = await checkForUpdate();
  $('s-test-result').textContent = r === 'aggiornato' ? `Sei già all'ultima versione (${JARVIS_VERSION}).`
    : r === 'errore' ? 'Non riesco a controllare: manca la rete?'
      : `È uscita la versione ${r}: chiudi questa finestra e tocca la scritta dorata in alto per installarla.`;
});

// ---------- trasloco della memoria ----------

function exportMemory() {
  const s = getSettings();
  const data = {
    jarvis: 1,
    memories: store.get('memories', []), diary: store.get('diary', []), lists: store.get('lists', {}),
    boards: store.get('boards', {}), reminders: store.get('reminders', []), summary: brain.summary,
    settings: { geminiKey: s.geminiKey, spotifyClientId: s.spotifyClientId, place: s.place, wakeWords: s.wakeWords },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `JARVIS:${btoa(bin)}`;
}

function importMemory(code) {
  const raw = code.trim().replace(/^JARVIS:/, '').replace(/\s+/g, '');
  const bin = atob(raw);
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  if (!data || data.jarvis !== 1) throw new Error('codice non valido');
  const uniq = (a) => [...new Set(a)];
  store.set('memories', uniq([...store.get('memories', []), ...(data.memories || [])]).slice(-150));
  const diary = [...store.get('diary', [])];
  (data.diary || []).forEach((d) => { if (!diary.some((x) => x.text === d.text)) diary.push(d); });
  store.set('diary', diary.slice(-40));
  const lists = store.get('lists', {});
  Object.entries(data.lists || {}).forEach(([k, v]) => { lists[k] = uniq([...(lists[k] || []), ...v]); });
  store.set('lists', lists);
  const boards = store.get('boards', {});
  Object.entries(data.boards || {}).forEach(([k, v]) => { boards[k] = uniq([...(boards[k] || []), ...v]); });
  store.set('boards', boards);
  const rem = store.get('reminders', []);
  (data.reminders || []).forEach((r) => { if (!rem.some((x) => x.text === r.text && x.due === r.due)) rem.push(r); });
  store.set('reminders', rem.sort((a, b) => a.due - b.due));
  if (data.summary && !brain.summary) { brain.summary = data.summary; brain.persist(); }
  const cur = getSettings();
  const inc = data.settings || {};
  saveSettings({
    geminiKey: cur.geminiKey || inc.geminiKey || '', spotifyClientId: cur.spotifyClientId || inc.spotifyClientId || '',
    place: cur.place || inc.place || '', wakeWords: cur.wakeWords || inc.wakeWords || '',
  });
  return { ricordi: (data.memories || []).length, diario: (data.diary || []).length };
}

$('s-export').addEventListener('click', async () => {
  const code = exportMemory();
  $('s-transfer').value = code;
  try {
    await navigator.clipboard.writeText(code);
    $('s-transfer-msg').textContent = 'Copiato. Incollalo nel Jarvis dell\'altro dispositivo, in questo stesso riquadro, e premi Importa.';
  } catch {
    $('s-transfer').select();
    $('s-transfer-msg').textContent = 'Seleziona tutto il testo qui sopra, copialo e incollalo nel Jarvis dell\'altro dispositivo.';
  }
});

$('s-import').addEventListener('click', () => {
  try {
    const r = importMemory($('s-transfer').value);
    $('s-transfer').value = '';
    $('s-transfer-msg').textContent = `Importato: ${r.ricordi} ricordi e ${r.diario} pagine di diario uniti a quelli già presenti.`;
    openSettings();
    refreshReminders();
    sys('sys-brain', !!getSettings().geminiKey);
  } catch {
    $('s-transfer-msg').textContent = 'Il codice non è valido o è incompleto: copialo di nuovo per intero.';
  }
});

// ---------- avvio ----------

let storagePersistent = null;
try { navigator.storage?.persisted?.().then((ok) => { storagePersistent = ok; }); } catch { /* ignore */ }

let wakeLock = null;
let noSleep = null;
// Dove il blocco schermo "ufficiale" manca (iPhone e iPad meno recenti) si usa NoSleep,
// una piccola libreria che tiene sveglio lo schermo. Va caricata prima del tocco su ATTIVA.
if (!('wakeLock' in navigator)) {
  const sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/nosleep/0.12.0/NoSleep.min.js';
  sc.onload = () => { try { noSleep = new window.NoSleep(); } catch { /* ignore */ } };
  document.head.append(sc);
}
async function keepAwake() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      screenAwake = 'attivo';
    } else if (noSleep) {
      await noSleep.enable();
      screenAwake = 'attivo (riserva)';
    } else {
      screenAwake = 'non disponibile: imposta il blocco automatico su Mai';
    }
  } catch (e) {
    screenAwake = `non riuscito (${e && e.name ? e.name : 'errore'})`;
  }
}
let screenAwake = 'non ancora richiesto';
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
  // se c'è una conversazione in memoria, lo dice: non riparte da zero
  if (brain.remembered() > 0) {
    const hello = h < 5 ? 'Ancora sveglio, Signore?' : h < 13 ? 'Buongiorno, Signore.' : h < 18 ? 'Buon pomeriggio, Signore.' : 'Buonasera, Signore.';
    return `Sistemi online. ${hello} Bentornato: ricordo dove eravamo rimasti.`;
  }
  if (h < 5) return 'Sistemi online. Ancora sveglio, Signore? Non ti giudico. Quasi.';
  if (h < 13) return 'Sistemi online. Buongiorno, Signore.';
  if (h < 18) return 'Sistemi online. Buon pomeriggio, Signore.';
  return 'Sistemi online. Buonasera, Signore.';
}

async function boot() {
  mouth.unlock(); // subito, dentro il tocco
  unlockAudio();
  keepAwake(); // anche questo dentro il tocco: la riserva per Apple parte solo così
  if (ears.supported && IOS) { try { ears.start(); } catch { /* ignore */ } } // Safari chiede il microfono solo dentro un tocco
  $('boot').classList.add('gone');
  try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  keepAwake();
  setMode('thinking');
  core.burst(120);

  sys('sys-voice', !!window.speechSynthesis);
  sys('sys-brain', !!getSettings().geminiKey);
  if (getSettings().geminiKey) brain.warmup().then(() => sys('sys-brain', true)).catch(() => sys('sys-brain', false, true));

  if (!ears.supported) {
    showJarvis(IOS_OTHER_BROWSER
      ? 'Su iPhone e iPad posso ascoltarti solo con Safari, Signore: aprimi lì. Qui puoi comunque scrivermi con la tastiera.'
      : IOS && STANDALONE
        ? 'Aperto dall\'icona questo dispositivo non mi dà il microfono, Signore: aprimi da Safari per parlarmi. Qui puoi scrivermi con la tastiera.'
        : IOS
          ? 'Non riesco ad accedere al microfono, Signore. Controlla in Impostazioni che Siri e Dettatura siano attivi. Intanto puoi scrivermi con la tastiera.'
          : 'Questo browser non mi lascia usare il microfono, Signore: aprimi con Google Chrome. Intanto puoi scrivermi con la tastiera.');
  }

  // chiede la posizione adesso, dentro il tocco: così Chrome mostra la richiesta di permesso
  locate(null, { force: true }).then(refreshWeather).catch((e) => { logError(`posizione: ${e.message}`); refreshWeather(); });
  if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch { /* ignore */ } }
  refreshBody();
  // chiede a Chrome di non cancellare mai la memoria di Jarvis (chiave, ricordi, diario)
  try { navigator.storage?.persist?.().then((ok) => { storagePersistent = ok; }); } catch { /* ignore */ }

  await new Promise((r) => setTimeout(r, 1400));
  state.busy = true;
  try {
    await say(getSettings().geminiKey ? greeting() : 'Sistemi online, Signore. Mi manca solo il cervello: incolla la chiave Gemini nelle impostazioni.');
  } finally {
    state.busy = false;
  }
  if (!getSettings().geminiKey) openSettings();
  await flushQueue();
  listenAgain();
  // se l'ultima volta l'app è stata chiusa senza saluto, il diario si scrive adesso
  if (getSettings().geminiKey) brain.reflectIfPending();
}

$('btn-boot').addEventListener('click', boot);

(async function init() {
  window.__jarvisReady = true;
  document.body.classList.add('is-off');
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(checkReminders, 1000);
  setInterval(refreshWeather, 15 * 60 * 1000);
  setInterval(refreshMusic, 30 * 1000);
  setInterval(checkForUpdate, 30 * 60 * 1000);
  refreshReminders();
  if (knownLocation() || getSettings().place) refreshWeather(); // altrimenti aspetta il tocco su ATTIVA
  refreshBoard();

  const sp = await spotify.handleRedirect().catch((e) => ({ ok: false, error: e.message }));
  if (sp && !sp.ok) showJarvis(`Il collegamento con Spotify non è riuscito: ${sp.error}`);
  if (sp && sp.ok) showJarvis('Spotify collegato, Signore. Tocca ATTIVA e chiedimi un po\' di musica.');
  let justUpdated = false;
  try { justUpdated = sessionStorage.getItem('jarvis.justUpdated') === '1'; sessionStorage.removeItem('jarvis.justUpdated'); } catch { /* ignore */ }
  if (justUpdated) $('boot-hint').textContent = `Aggiornato alla versione ${JARVIS_VERSION}. Tocca ATTIVA per riaccendermi.`;
  if (keyImported) $('boot-hint').textContent = 'Chiave ricevuta: ora ho un cervello. Tocca ATTIVA.';
  else if (!getSettings().geminiKey) $('boot-hint').textContent = 'Tocca per accendere. Poi ti chiederò la chiave Gemini: senza quella non posso ragionare.';
  refreshMusic();

  if ('serviceWorker' in navigator) {
    // quando arriva una versione nuova e Jarvis è ancora spento, ricarica per usarla subito
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && state.mode === 'off') location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update();
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  }
})();
