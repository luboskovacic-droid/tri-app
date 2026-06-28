const CACHE_NAME = 'kcal-sport-pwa-v8';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './food.js',
  './sport.js',
  './calendar-sport.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. Inštalácia Service Workera – Atomické uloženie kritických súborov
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pred-načítanie kritických assetov...');
        return Promise.allSettled(
          ASSETS.map(url => cache.add(url).catch(err => console.error(`Zlyhalo cacheovanie: ${url}`, err)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Aktivácia – Okamžité prevzatie kontroly a agresívne čistenie starej cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[Service Worker] Mazanie starej cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Stratégia: Stale-While-Revalidate (Rýchlosť cache + čerstvosť siete)
self.addEventListener('fetch', (e) => {
  // Ignorujeme požiadavky iných domén (napr. analytiku alebo externé API) a ne-GET metódy
  if (
    e.request.method !== 'GET' ||
    !e.request.url.startsWith(self.location.origin) ||
    !e.request.url.startsWith(self.registration.scope)
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Vytvoríme sieťovú požiadavku, ktorá beží asynchrónne na pozadí
      const networkFetch = fetch(e.request)
        .then((networkResponse) => {
          // Ak je odpoveď validná, aktualizujeme cache za behu pre ďalšiu návštevu
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[Service Worker] Sieť zlyhala, bežíme čisto z cache.', err);
        });

      // VRACIAME OKAMŽITE: Ak máme cache, vrátime ju (0 ms lag). Ak nie, čakáme na sieť.
      return cachedResponse || networkFetch;
    })
  );
});
