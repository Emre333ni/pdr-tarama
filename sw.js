/* Tünel PDR service worker: uygulamayı ve harita kitaplığını telefona kaydeder, çevrimdışı açılır. */
const V = 'tunel-pdr-20261111212940';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
];
const TILE_HOSTS = ['server.arcgisonline.com', 'tile.openstreetmap.org'];
const TILE_CACHE = 'tunel-tiles';
const RUNTIME_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(SHELL);
    for (const u of LIBS) { try { await c.put(u, await fetch(new Request(u, { mode: 'no-cors' }))); } catch (err) { /* sonra tekrar denenir */ } }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k.startsWith('tunel-pdr-')) await caches.delete(k);
    await self.clients.claim();
  })());
});
function timeoutFetch(req, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('zaman aşımı')), ms);
    fetch(req).then((r) => { clearTimeout(t); res(r); }, (err) => { clearTimeout(t); rej(err); });
  });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('yonetim.html')) return; // yönetim paneli önbelleğe girmez
    if (req.mode === 'navigate') {
      // Çevrimiçiyken güncel sayfa; sinyal zayıf veya yoksa 3 sn sonra kayıtlı sürüm
      e.respondWith(timeoutFetch(req, 3000).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put('./index.html', cp)); } return r; })
        .catch(() => caches.match('./index.html')));
      return;
    }
    e.respondWith(caches.match(req).then((h) => h || fetch(req)));
    return;
  }
  if (TILE_HOSTS.includes(url.hostname)) {
    // Karolar: önce telefondaki kayıt, yoksa ağ (başarılıysa kaydet)
    e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((r) => { if (r && r.ok && r.type !== 'opaque') { const cp = r.clone(); caches.open(TILE_CACHE).then((c) => c.put(req, cp)); } return r; })));
    return;
  }
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
