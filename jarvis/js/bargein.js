// Interruzione a voce ("barge-in"): mentre Jarvis parla, un orecchio leggero misura il volume
// che arriva al microfono. Non trascrive nulla: serve solo a capire se il Signore ha iniziato
// a parlare, per zittirsi subito e ascoltarlo.
//
// Il microfono viene aperto con la cancellazione dell'eco, così la voce di Jarvis che esce
// dall'altoparlante pesa poco. La soglia si adatta da sola al livello "normale" del momento.
import { getSettings } from './store.js';
import { IOS } from './platform.js';

// Senza taratura: soglia relativa al rumore del momento (k) con un minimo assoluto (floor).
// Con la taratura: ci si ferma solo per una voce forte almeno una certa frazione di quella del Signore
// (near), così le voci dall'altro lato della stanza restano sotto.
const LEVELS = {
  alta:  { k: 2.6, floor: 0.035, near: 0.35 },
  media: { k: 3.6, floor: 0.06,  near: 0.5 },
  bassa: { k: 5.0, floor: 0.09,  near: 0.7 },
};

export function bargeMode() {
  // su iPhone/iPad aprire il microfono mentre parla abbassa il volume della voce: lì parte spenta
  return getSettings().bargeIn || (IOS ? 'off' : 'media');
}

export class BargeIn {
  constructor({ getAudioContext, onInterrupt, onInfo }) {
    this.getAudioContext = getAudioContext;
    this.onInterrupt = onInterrupt;
    this.onInfo = onInfo || (() => {});
    this.active = false;
    this.session = 0;
    this.boost = 1;          // sale se scatta a vuoto: diventa meno sensibile da solo
    this.falseTriggers = 0;
    this.lastError = '';
    this.triggers = 0;
  }

  available() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start() {
    const mode = bargeMode();
    if (this.active || mode === 'off' || !this.available()) return false;
    const cfg = LEVELS[mode] || LEVELS.media;
    this.active = true;
    const my = ++this.session;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: false } },
      });
    } catch (e) {
      this.active = false;
      this.lastError = e && e.name ? e.name : 'errore';
      return false;
    }
    if (my !== this.session) { stream.getTracks().forEach((t) => t.stop()); return false; } // nel frattempo ha finito di parlare
    this.lastError = '';
    try {
      const ctx = this.getAudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      this.stream = stream;
      this.src = src;
      const buf = new Uint8Array(an.fftSize);
      const t0 = performance.now();
      let ema = null;
      let hot = 0;
      this.timer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / buf.length);
        if (ema === null) ema = rms;
        // tarato: conta il volume della voce del Signore; non tarato: il rumore del momento
        const owner = Number(getSettings().voiceLevel) || 0;
        const relative = Math.max(ema * cfg.k, cfg.floor);
        const threshold = (owner ? Math.max(owner * cfg.near, ema * 2.2) : relative) * this.boost;
        const loud = rms > threshold;
        // i primi istanti servono a tarare il livello di fondo (compresa l'eco della mia voce)
        if (performance.now() - t0 > 350 && loud) hot++; else hot = Math.max(0, hot - 1);
        if (!loud) ema = ema * 0.95 + rms * 0.05; // segue il livello normale, non i picchi
        this.level = rms;
        this.threshold = threshold;
        if (hot >= 7) { // circa 300 ms di voce forte e sostenuta: una sillaba isolata non basta
          this.triggers++;
          this.stop();
          this.onInterrupt();
        }
      }, 40);
    } catch (e) {
      this.lastError = e && e.name ? e.name : 'errore';
      this.stop();
      return false;
    }
    return true;
  }

  // Taratura: ascolta per qualche secondo il Signore che parla e misura il volume della sua voce
  // e quello del rumore di fondo. Restituisce { voice, noise } oppure null se non ha sentito abbastanza.
  async measure(ms = 5000) {
    if (!this.available()) return null;
    this.stop();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: false } },
      });
    } catch (e) {
      this.lastError = e && e.name ? e.name : 'errore';
      return null;
    }
    const ctx = this.getAudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const frames = [];
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
        frames.push(Math.sqrt(sum / buf.length));
      }, 40);
      setTimeout(() => { clearInterval(iv); resolve(); }, ms);
    });
    try { src.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    this.stoppedAt = Date.now();
    if (frames.length < 20) return null;
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    const noise = at(0.15);            // i momenti di pausa: il fondo della stanza
    const voice = at(0.8);             // il volume tipico mentre parla
    const talking = frames.filter((f) => f > Math.max(noise * 3, 0.01)).length / frames.length;
    if (voice < Math.max(noise * 3, 0.012) || talking < 0.2) return null; // troppo poco parlato, o troppo piano
    return { voice, noise };
  }

  // Libera subito il microfono: il riconoscimento vocale ne ha bisogno tutto per sé.
  stop() {
    this.session++;
    if (this.stream) this.stoppedAt = Date.now();
    this.active = false;
    clearInterval(this.timer);
    try { this.src && this.src.disconnect(); } catch { /* ignore */ }
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    this.src = null;
    this.stream = null;
  }

  // Dopo un'interruzione: se poi il Signore ha parlato davvero era giusta, altrimenti era un falso allarme.
  // Due falsi allarmi di fila e la sensibilità si abbassa da sola.
  outcome(heardSpeech) {
    if (heardSpeech) { this.falseTriggers = 0; return; }
    if (++this.falseTriggers >= 2) {
      this.falseTriggers = 0;
      this.boost = Math.min(this.boost * 1.4, 4);
      this.onInfo(`interruzione scattata a vuoto: sensibilità ridotta (x${this.boost.toFixed(1)})`);
    }
  }
}
