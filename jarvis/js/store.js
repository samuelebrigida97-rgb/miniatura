// Piccolo wrapper attorno a localStorage: tutto ciò che Jarvis ricorda vive sul tablet.
const PREFIX = 'jarvis.';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* storage pieno o bloccato: pazienza */ }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};

export const DEFAULT_SETTINGS = {
  geminiKey: '',
  geminiModel: '',          // vuoto = scelta automatica
  voiceName: '',
  rate: 1.05,
  pitch: 0.95,
  place: '',                // città scritta a mano; vuoto = posizione automatica (GPS)
  wakeWords: '',            // parole di attivazione in più, separate da virgola
  spotifyClientId: '',
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
}

export function saveSettings(patch) {
  store.set('settings', { ...getSettings(), ...patch });
}
