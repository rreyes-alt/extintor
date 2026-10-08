/* Service worker: deja la app disponible sin señal. */
const VERSION = "ext-v1.0.0";
const APP = [
  "./", "index.html", "css/styles.css", "js/config.js", "js/store.js", "js/app.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];
const CDN = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com"];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION).then(c => Promise.all(APP.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  const cdn = CDN.includes(url.hostname);
  if (!propio && !cdn) return; // Supabase, mapas, etc.: siempre a la red

  // Archivos de la app: red primero (para recibir actualizaciones), caché si no hay señal
  if (propio) {
    ev.respondWith(
      fetch(req).then(res => {
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
    );
    return;
  }
  // Librerías de CDN: caché primero
  ev.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone();
      caches.open(VERSION).then(c => c.put(req, copia));
      return res;
    }))
  );
});
