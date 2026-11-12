// Service worker minimo: permette di installare Jarvis come app e di aprirlo anche con rete instabile.
// Strategia "prima la rete": gli aggiornamenti arrivano subito, la cache serve solo da riserva.
const CACHE = 'jarvis-v21';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg',
  'js/main.js', 'js/neural.js', 'js/voice.js', 'js/brain.js', 'js/tools.js', 'js/spotify.js', 'js/store.js', 'js/seed.js', 'js/platform.js', 'js/recall.js', 'js/bargein.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' = chiede sempre al server se il file è cambiato: niente versioni vecchie mischiate alle nuove
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
