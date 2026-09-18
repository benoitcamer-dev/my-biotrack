const CACHE = 'bt-v5'; // bump = purge de l'ancien cache (cache-first jamais revalidé) à l'activation
const CORE = [];
self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
// Network-first + fallback cache pour TOUT le même-origine (HTML, app.js, styles.css...).
// Avant : seul le HTML était network-first, app.js/styles.css étaient cache-first
// SANS jamais être revalidés une fois en cache — un déploiement pouvait donc rester
// invisible indéfiniment pour un utilisateur déjà passé une fois par l'app, même
// après un reload normal (seul un hard-reload + purge manuelle du cache le révélait).
// Voir historique du 15-16/08/2026.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'reload' }) // 'reload' = ignore le cache HTTP du navigateur (sinon
      // GitHub Pages sert Cache-Control: max-age=600 et ce fetch peut être satisfait par le cache
      // HTTP local sans jamais toucher le réseau, même si ce handler se veut "network-first" —
      // voir historique du 18/09/2026.
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
