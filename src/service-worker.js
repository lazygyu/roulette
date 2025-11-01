const CACHE_NAME = 'marble-roulette';
const urlsToCache = ['/roulette', '/roulette/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(
      (res) => res || fetch(e.request),
    ),
  );
});
