const CACHE_NAME = 'legrosbarbu-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first - ne cache rien, toujours récupérer depuis le réseau
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
