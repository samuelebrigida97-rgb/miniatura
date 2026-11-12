// Udito (riconoscimento vocale) e voce (sintesi) usando le API del browser: gratis, niente server.
import { getSettings } from './store.js';
import { IOS, ANDROID, MOBILE } from './platform.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// Sui dispositivi mobili il riconoscimento "continuo" ripete e accumula le frasi:
// lì si usano sessioni brevi (una frase per volta) che ripartono da sole.
// Safari su iPhone/iPad in più segna come "definitive" frasi ancora a metà: per lui
// la frase si considera finita solo dopo una pausa o a fine sessione.

export class Ears {
  constructor({ onFinal, onInterim, onError, onActive }) {
    this.onFinal = onFinal;
    this.onInterim = onInterim || (() => {});
    this.onError = onError || (() => {});
    this.onActive = onActive || (() => {});
    this.wanted = false;
    this.running = false;
    this.supported = !!SR;
    this.fatal = false;
    this.needsTap = false;   // Safari a volte vuole un tocco per riaccendere il microfono
    this.everWorked = false;
    this.sessionText = '';
    this.failures = 0;
  }

  _flush() {
    clearTimeout(this._quiet);
    const t = this.sessionText.trim();
    this.sessionText = '';
    if (t) this.onFinal(t);
  }

  // Unisce i pezzi di una sessione; se un pezzo è solo la versione più lunga del precedente, lo sostituisce.
  _sessionTranscript(results) {
    const parts = [];
    for (let i = 0; i < results.length; i++) {
      const t = (results[i][0].transcript || '').trim();
      if (!t) continue;
      const last = parts[parts.length - 1];
      if (last && t.toLowerCase().startsWith(last.toLowerCase())) parts[parts.length - 1] = t;
      else if (last && last.toLowerCase().startsWith(t.toLowerCase())) continue;
      else parts.push(t);
    }
    return parts.join(' ');
  }

  _create() {
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = !MOBILE;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => { this.running = true; this.everWorked = true; this.needsTap = false; this.onActive(true); };
    rec.onresult = (ev) => {
      this.failures = 0;
      if (MOBILE) {
        const text = this._sessionTranscript(ev.results);
        this.sessionText = text;
        const last = ev.results[ev.results.length - 1];
        if (text) this.onInterim(text);
        if (ANDROID && last && last.isFinal) { this._flush(); return; }
        // Safari: la frase è finita quando smette di cambiare per un po'
        clearTimeout(this._quiet);
        this._quiet = setTimeout(() => {
          this._flush();
          try { rec.stop(); } catch { /* ignore */ } // chiude la sessione: ne ripartirà una pulita
        }, IOS ? 1400 : 4000);
        return;
      }
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          if (text.trim()) this.onFinal(text.trim());
        } else {
          interim += text;
        }
      }
      if (interim) this.onInterim(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        if (IOS && this.everWorked) {
          // il permesso c'è, ma Safari vuole un tocco per riaprire il microfono
          this.needsTap = true;
          this.wanted = false;
          this.onError('serve-un-tocco');
        } else {
          this.fatal = true;
          this.wanted = false;
          this.onError('microfono-negato');
        }
      } else if (ev.error === 'audio-capture') {
        this.failures++;
        this.onError('microfono-occupato');
      } else if (ev.error === 'network') {
        this.failures++;
        this.onError('rete');
      }
      // 'no-speech' e 'aborted' sono normali: si riparte da soli
    };
    rec.onend = () => {
      this.running = false;
      if (this._onStopped) this._onStopped();
      if (this.wanted) this._flush(); // frase rimasta in sospeso a fine sessione
      else { clearTimeout(this._quiet); this.sessionText = ''; }
      this.onActive(false);
      if (this.wanted && !this.fatal) {
        clearTimeout(this._restart);
        // se continua a fallire (rete assente, microfono occupato) rallenta invece di martellare
        const wait = Math.min((IOS ? 400 : 250) + this.failures * 1500, 8000);
        this._restart = setTimeout(() => this._start(), wait);
      }
    };
    return rec;
  }

  _start() {
    if (!this.wanted || this.running) return;
    try {
      if (!this.rec) this.rec = this._create();
      this.rec.start();
    } catch (e) {
      if (IOS && e && e.name === 'NotAllowedError' && this.everWorked) {
        this.needsTap = true;
        this.wanted = false;
        this.onError('serve-un-tocco');
        return;
      }
      // "already started" o simili: ritenta tra poco
      clearTimeout(this._restart);
      this._restart = setTimeout(() => this._start(), 600);
    }
  }

  start() {
    if (!this.supported) return;
    this.fatal = false;
    this.wanted = true;
    this._start();
  }

  // Spegne l'ascolto. La promessa si chiude quando il microfono è davvero libero:
  // sui dispositivi mobili, finché non lo è, l'audio della voce esce muto o tagliato.
  stop() {
    this.wanted = false;
    this.sessionText = '';
    clearTimeout(this._restart);
    clearTimeout(this._quiet);
    if (!this.rec || !this.running) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); this._onStopped = null; resolve(); };
      const timer = setTimeout(done, 700);
      this._onStopped = done;
      try { this.rec.abort(); } catch { done(); }
    });
  }
}

export class Mouth {
  constructor({ onStart, onEnd }) {
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.speaking = false;
    this._token = 0;
    this.unlocked = false;
    this.lastProblem = '';
    if (this.synth) {
      this.loadVoices();
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  // Da chiamare DENTRO un tocco dell'utente: iPhone e alcuni Android lasciano parlare la pagina
  // solo se la prima frase parte nell'istante del tocco. Una frase muta "sblocca" la voce.
  unlock() {
    if (!this.synth || this.unlocked || this.speaking) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'it-IT';
      this.synth.speak(u);
      this.unlocked = true;
    } catch { /* ignore */ }
  }

  loadVoices() {
    this.voices = this.synth.getVoices();
  }

  italianVoices() {
    return this.voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
  }

  pickVoice() {
    const { voiceName } = getSettings();
    const it = this.italianVoices();
    return (
      it.find((v) => v.name === voiceName) ||
      it.find((v) => /google/i.test(v.name)) ||
      // Apple: prima le voci "migliorate/premium", poi quelle maschili note, poi Alice
      it.find((v) => /premium|enhanced|migliorata|siri/i.test(v.name)) ||
      it.find((v) => /luca|rocko|eddy|reed|grandpa/i.test(v.name)) ||
      it[0] ||
      null
    );
  }

  // Divide il testo in frasi: Chrome su Android tronca le frasi troppo lunghe.
  chunks(text) {
    const clean = text
      .replace(/[*_#`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = clean.match(/[^.!?;:]+[.!?;:]*/g) || [clean];
    const out = [];
    let buf = '';
    for (const p of parts) {
      if ((buf + p).length > 180 && buf) {
        out.push(buf.trim());
        buf = p;
      } else {
        buf += p;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  // Voce "in diretta": si possono passare pezzi di testo mentre arrivano (push) e Jarvis
  // comincia a parlare alla prima frase completa, senza aspettare tutta la risposta.
  stream() {
    if (!this.synth) return { push() {}, end: () => Promise.resolve() };
    const wasBusy = this.synth.speaking || this.synth.pending;
    this.cancel();
    try { this.synth.resume(); } catch { /* ignore */ } // Android a volte resta "in pausa"
    const token = ++this._token;
    const { rate, pitch } = getSettings();
    const voice = this.pickVoice();
    this.speaking = true;
    this.onStart();

    const queue = [];
    let buf = '';
    let ended = false;
    let playing = false;
    let started = false;
    let resolveEnd;
    const done = new Promise((r) => { resolveEnd = r; });
    const finish = () => {
      if (token === this._token) { this.speaking = false; this.onEnd(); }
      resolveEnd();
    };

    const utter = (piece, next) => {
      let guard;
      try {
        const u = new SpeechSynthesisUtterance(piece);
        u.lang = 'it-IT';
        try { if (voice) u.voice = voice; } catch { /* voce non valida: usa quella di sistema */ }
        u.rate = Number(rate) || 1;
        u.pitch = Number(pitch) || 1;
        let heard = false;
        // rete di sicurezza: a volte Android non chiama onend
        guard = setTimeout(() => {
          u.onend = null; u.onerror = null;
          if (!heard) this.problem('la sintesi vocale non ha dato segni di vita (volume a zero, o voce italiana non installata?)');
          next();
        }, piece.length * 110 + 4000);
        u.onstart = () => { heard = true; this.lastProblem = ''; };
        u.onend = () => { clearTimeout(guard); next(); };
        u.onerror = (ev) => {
          clearTimeout(guard);
          if (ev && ev.error && ev.error !== 'interrupted' && ev.error !== 'canceled') this.problem(`errore della sintesi vocale: ${ev.error}`);
          next();
        };
        this._current = u; // tiene vivo l'oggetto: altrimenti Chrome può non chiamare onend
        this.synth.speak(u);
      } catch {
        // la voce non deve mai bloccare Jarvis: se qualcosa va storto si prosegue in silenzio
        clearTimeout(guard);
        next();
      }
    };

    const pump = () => {
      if (token !== this._token) return resolveEnd(); // interrotto
      if (playing) return;
      if (!queue.length) { if (ended) finish(); return; }
      let piece = queue.shift();
      while (queue.length && `${piece} ${queue[0]}`.length <= 180) piece += ` ${queue.shift()}`;
      playing = true;
      utter(piece, () => { playing = false; pump(); });
    };
    const kick = () => {
      // dopo un cancel() Android ha bisogno di un attimo, o si mangia la prima frase
      if (!started) { started = true; if (wasBusy) { setTimeout(pump, 150); return; } }
      pump();
    };

    const clean = (t) => t.replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();
    // sposta in coda le frasi complete (finite da punteggiatura e seguite da uno spazio)
    const split = (final) => {
      const re = /^([\s\S]*?[.!?…:;]+["»)\]]*)(\s+|$)/;
      let m;
      while ((m = buf.match(re)) && (final || m[2].length > 0)) {
        const sentence = clean(m[1]);
        buf = buf.slice(m[0].length);
        if (sentence) queue.push(...this.chunks(sentence));
      }
      if (final) {
        const rest = clean(buf);
        buf = '';
        if (rest) queue.push(...this.chunks(rest));
      }
    };

    return {
      push: (delta) => {
        if (token !== this._token || !delta) return;
        buf += delta;
        split(false);
        if (queue.length) kick();
      },
      end: () => {
        split(true);
        ended = true;
        kick();
        return done;
      },
    };
  }

  speak(text) {
    if (!this.synth || !text) return Promise.resolve();
    const s = this.stream();
    s.push(text);
    return s.end();
  }

  problem(text) {
    if (this.lastProblem === text) return;
    this.lastProblem = text;
    this.onProblem?.(text);
  }

  cancel() {
    this._token++;
    if (this.synth) this.synth.cancel();
    if (this.speaking) {
      this.speaking = false;
      this.onEnd();
    }
  }
}
