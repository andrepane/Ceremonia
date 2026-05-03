const CACHE_VERSION = "v6";
const STATIC_CACHE = `boda-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `boda-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./manifest.webmanifest?v=4",
  "./icon-192.png?v=4",
  "./icon-512.png?v=4"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const validCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => (validCaches.has(key) ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(RUNTIME_CACHE, request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await cacheResponse(RUNTIME_CACHE, request, response);
  return response;
}

async function cacheResponse(cacheName, request, response) {
  if (!shouldCache(request, response)) return;

  const responseClone = response.clone();
  const cache = await caches.open(cacheName);
  await cache.put(request, responseClone);
}

function shouldCache(request, response) {
  if (!response || response.status !== 200) return false;
  if (request.method !== "GET") return false;
  return true;
}
