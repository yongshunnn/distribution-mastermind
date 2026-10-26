// Minimal service worker: network-first for pages (falls back to the last copy viewed when offline),
// cache-first for static assets. Spec §3: offline read of last-viewed data is a nice-to-have.
const PAGES = 'dm-pages-v1';
const ASSETS = 'dm-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => (res.ok && c.put(req, res.clone()), res))),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? new Response('<h1>Offline</h1><p>This page has not been viewed on this device yet.</p>', { headers: { 'Content-Type': 'text/html' } })),
    );
  }
});
