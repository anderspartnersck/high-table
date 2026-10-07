/* HIGH TABLE (side build) -- offline service worker for the home-screen app.
   Pages/scripts: NETWORK-FIRST (a pushed update shows up on the next launch), cache as fallback offline.
   Art/audio: CACHE-FIRST, filled as the game fetches them -- one full play-through and it runs offline.
   Bump CACHE to drop everything cached by an old version. */
const CACHE = 'high-table-side-v1';
const CORE = ['./', './index.html', './side.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon-180.png',
  './lib/rink-geo.js', './lib/pucks.js', './lib/ghost.js', './lib/catalog.js', './lib/menu.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;   // never touch other sites
  if (req.headers.has('range')) return;   // <audio>/<video> byte-range requests (iOS) go straight to the network -- a cached 200 can break playback
  const code = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname);
  if (code) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => { if (r.ok && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return r; })));
  }
});
