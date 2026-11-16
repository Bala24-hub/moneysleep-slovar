// Service worker Moneysleep: приложение и сцены — при установке, пакет выбранного языка — по сообщению.
// Версия и список файлов подставляются при сборке (vite.config.ts).
const VERSION = '__VERSION__';
const SHELL = `ms-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ms-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Пакет языка (pack.json + аудио) — в отдельный кэш, чтобы работал офлайн.
self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type !== 'cache-pack') return;
  const name = `ms-pack-${m.lang}-v${m.version}`;
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(`ms-pack-${m.lang}-`) && k !== name).map((k) => caches.delete(k))))
      .then(() => caches.open(name))
      .then((c) => Promise.all(m.files.map((u) => c.match(u, { ignoreVary: true }).then((hit) => hit || c.add(u).catch(() => {}))))),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html', { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && /\.(mp3|m4a|json|png|jpg|svg|woff2)$/.test(new URL(req.url).pathname)) {
          const copy = res.clone();
          caches.open('ms-runtime').then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
