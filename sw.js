const CACHE_NAME = "boda-cintia-andrea-v3";

// Solo assets estáticos que no rompen deploys con contenido viejo.
const STATIC_ASSETS = ["./manifest.webmanifest", "./icon-192.png?v=3", "./icon-512.png?v=3"];

// INSTALL → precache mínimo
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE → limpia cachés antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH → estrategia por tipo de recurso
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // HTML/documentos: network-first para evitar servir deploys viejos.
  if (event.request.destination === "document") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/CSS: stale-while-revalidate
  if (
    event.request.destination === "script" ||
    event.request.destination === "style"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Imágenes y otros: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
