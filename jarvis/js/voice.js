// Udito (riconoscimento vocale) e voce (sintesi) usando le API del browser: gratis, niente server.
import { getSettings } from './store.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// Su Android il riconoscimento "continuo" di Chrome ripete e accumula le frasi:
// lì si usano sessioni brevi (una frase per volta) che ripartono da sole.
const ANDROID = /Android/i.test(navigator.userAgent);

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
    this.sessionText = '';
    this.failures = 0;
  }

  _flush() {
    const t = this.sessionText.trim();
    this.sessionText = '';
    if (t) this.onFinal(t);
  }

  _create() {
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = !ANDROID;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => { this.running = true; this.onActive(true); };
    rec.onresult = (ev) => {
      this.failures = 0;
      if (ANDROID) {
        // una sessione = una frase: si tiene sempre la trascrizione più recente e completa
        let text = '';
        for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
        this.sessionText = text;
        const last = ev.results[ev.results.length - 1];
        if (last && last.isFinal) this._flush();
        else if (text.trim()) this.onInterim(text.trim());
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
        this.fatal = true;
        this.wanted = false;
        this.onError('microfono-negato');
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
      if (this.wanted) this._flush(); // frase rimasta in sospeso a fine sessione
      else this.sessionText = '';
      this.onActive(false);
      if (this.wanted && !this.fatal) {
        clearTimeout(this._restart);
        // se continua a fallire (rete assente, microfono occupato) rallenta invece di martellare
        const wait = Math.min(250 + this.failures * 1500, 8000);
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
    } catch {
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

  stop() {
    this.wanted = false;
    this.sessionText = '';
    clearTimeout(this._restart);
    try { this.rec && this.rec.abort(); } catch { /* ignore */ }
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
    if (this.synth) {
      this.loadVoices();
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
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

  speak(text) {
    if (!this.synth || !text) return Promise.resolve();
    const wasBusy = this.synth.speaking || this.synth.pending;
    this.cancel();
    try { this.synth.resume(); } catch { /* ignore */ } // Android a volte resta "in pausa"
    const token = ++this._token;
    const { rate, pitch } = getSettings();
    const voice = this.pickVoice();
    const pieces = this.chunks(text);
    this.speaking = true;
    this.onStart();

    return new Promise((resolve) => {
      let i = 0;
      const finish = () => {
        if (token !== this._token) return resolve();
        this.speaking = false;
        this.onEnd();
        resolve();
      };
      const next = () => {
        if (token !== this._token) return resolve();
        if (i >= pieces.length) return finish();
        const piece = pieces[i++];
        let guard;
        try {
          const u = new SpeechSynthesisUtterance(piece);
          u.lang = 'it-IT';
          try { if (voice) u.voice = voice; } catch { /* voce non valida: usa quella di sistema */ }
          u.rate = Number(rate) || 1;
          u.pitch = Number(pitch) || 1;
          // rete di sicurezza: a volte Android non chiama onend
          guard = setTimeout(() => { u.onend = null; u.onerror = null; next(); }, piece.length * 110 + 4000);
          u.onend = () => { clearTimeout(guard); next(); };
          u.onerror = () => { clearTimeout(guard); next(); };
          this._current = u; // tiene vivo l'oggetto: altrimenti Chrome può non chiamare onend
          this.synth.speak(u);
        } catch {
          // la voce non deve mai bloccare Jarvis: se qualcosa va storto si prosegue in silenzio
          clearTimeout(guard);
          finish();
        }
      };
      // dopo un cancel() Android ha bisogno di un attimo, o si mangia la prima frase
      if (wasBusy) setTimeout(next, 150); else next();
    });
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
