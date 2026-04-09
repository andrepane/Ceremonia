const CACHE_NAME = "boda-cintia-andrea-v4";

const STATIC_ASSETS = [
  "./manifest.webmanifest",
  "./icon-192.png?v=4",
  "./icon-512.png?v=4",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (request.headers.has("range")) return;

  if (request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

if (request.destination === "image") {
  event.respondWith(networkFirst(request));
  return;
}

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      await cacheResponse(request, response);
      return response;
    })
    .catch(() => null);

  if (event) {
    event.waitUntil(networkPromise.then(() => undefined).catch(() => undefined));
  }

  if (cached) return cached;

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  return fetch(request);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await cacheResponse(request, response);
  return response;
}

async function cacheResponse(request, response) {
  if (!shouldCache(request, response)) return;

  try {
    const clone = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, clone);
  } catch {
    // Ignorar errores de cacheo para no romper la respuesta de red.
  }
}

function shouldCache(request, response) {
  if (!response) return false;
  if (response.status !== 200) return false;
  if (request.method !== "GET") return false;
  if (response.bodyUsed) return false;
  return true;
}
