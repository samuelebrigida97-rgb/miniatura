// Udito (riconoscimento vocale) e voce (sintesi) usando le API del browser: gratis, niente server.
import { getSettings } from './store.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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
  }

  _create() {
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => { this.running = true; this.onActive(true); };
    rec.onresult = (ev) => {
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
      } else if (ev.error === 'network') {
        this.onError('rete');
      }
      // 'no-speech' e 'aborted' sono normali: si riparte da soli
    };
    rec.onend = () => {
      this.running = false;
      this.onActive(false);
      if (this.wanted && !this.fatal) {
        clearTimeout(this._restart);
        this._restart = setTimeout(() => this._start(), 250);
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
    this.cancel();
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
        const u = new SpeechSynthesisUtterance(piece);
        u.lang = 'it-IT';
        if (voice) u.voice = voice;
        u.rate = Number(rate) || 1;
        u.pitch = Number(pitch) || 1;
        // rete di sicurezza: a volte Android non chiama onend
        const guard = setTimeout(() => { u.onend = null; next(); }, piece.length * 110 + 4000);
        u.onend = () => { clearTimeout(guard); next(); };
        u.onerror = () => { clearTimeout(guard); next(); };
        this.synth.speak(u);
      };
      next();
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
