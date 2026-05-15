// ===== sw.js =====
// Service Worker v5 — Network first para CSS/JS, cache solo para imágenes

const CACHE_NAME = 'kiosco-v5';
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_SHELL))
  );
  self.skipWaiting(); // Activa inmediatamente sin esperar
});

// ── Activate: borra TODOS los cachés viejos ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('🗑️ Borrando caché viejo:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim()) // Toma control de todas las pestañas
  );
});

// ── Fetch: estrategia por tipo de archivo ──────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejamos GET
  if (request.method !== 'GET') return;

  // Firebase / Google APIs → siempre red, sin caché
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('fonts.g')
  ) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // CSS y JS → NETWORK FIRST (siempre descarga lo más nuevo)
  // Si no hay red, usa el caché como respaldo
  if (url.pathname.match(/\.(css|js)$/)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Imágenes y SVG → cache first (no cambian seguido)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML → network first con fallback a offline.html
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => cached || caches.match('/offline.html'))
      )
  );
});