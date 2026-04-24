const CACHE = 'bt-v1';
const CORE = ['/'];

// Installation : mise en cache de la page principale
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE))
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache first pour index.html, network only pour Supabase/API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne jamais cacher les appels Supabase, API, ou autres domaines
  if (url.origin !== location.origin) return;

  // Cache first pour le HTML principal
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
        const networkFetch = fetch(e.request).then(response => {
          if (response.ok) {
            caches.open(CACHE).then(c => c.put(e.request, response.clone()));
          }
          return response;
        }).catch(() => null);

        // Répondre avec le cache si disponible, sinon attendre le réseau
        return cached || networkFetch;
      })
    );
    return;
  }

  // Pour les autres assets (icônes, manifeste) : cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
