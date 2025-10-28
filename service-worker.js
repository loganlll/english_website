/* Simple offline cache */
const VERSION = 'v4';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  // data
  './Opinion and argument.json',
  './Doubt, guessing and certainty.json',
  './Discussion and agreement.json',
  './Personal Qualities.json',
  './Feelings.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open('app-' + VERSION);
    await cache.addAll(APP_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => { if (!k.endsWith(VERSION)) return caches.delete(k); }));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith((async () => {
    const cache = await caches.open('app-' + VERSION);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (req.method === 'GET' && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      // Offline fallback: try index for navigations
      if (req.mode === 'navigate') return cache.match('./index.html');
      throw err;
    }
  })());
});
