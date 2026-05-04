// sw.js — Service Worker Kiosco PWA
const CACHE = 'kiosco-v2';
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.json',
  '/css/reset.css', '/css/variables.css', '/css/main.css',
  '/css/components.css', '/css/animations.css', '/css/extras.css',
  '/js/config.js', '/js/firebase.js', '/js/auth.js', '/js/store.js',
  '/js/cart.js', '/js/admin.js', '/js/dashboard.js', '/js/orders.js',
  '/js/notifications.js', '/js/share.js', '/js/ui-helpers.js', '/js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (/firebase|googleapis|gstatic|firebaseio/.test(url)) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  if (/\.(js|css|svg|png|ico|woff2?)$/.test(url)) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(c => c || caches.match('/offline.html'))
    )
  );
});
