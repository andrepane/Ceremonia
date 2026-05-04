const CACHE_VERSION = "v7";
const STATIC_CACHE = `boda-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `boda-runtime-${CACHE_VERSION}`;

const MAX_RUNTIME_ENTRIES = 50;
const OFFLINE_FALLBACK_URL = "/index.html";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest?v=4",
  "/icon-192.png?v=4",
  "/icon-512.png?v=4"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
    })()
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const validCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);
      const cacheKeys = await caches.keys();

      await Promise.all(
        cacheKeys.map((key) => (validCaches.has(key) ? Promise.resolve() : caches.delete(key)))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (isNetworkOnlyRequest(url)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (request.destination === "style" || request.destination === "script") {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(cacheFirstWithLimit(request));
    return;
  }

  event.respondWith(networkFirstGeneric(request));
});

function isNetworkOnlyRequest(url) {
  const hostname = url.hostname;

  return (
    hostname.includes("firebase") ||
    hostname.includes("googleapis.com") ||
    hostname.includes("gstatic.com") ||
    hostname.includes("firestore.googleapis.com") ||
    hostname.includes("identitytoolkit.googleapis.com") ||
    hostname.includes("securetoken.googleapis.com") ||
    hostname.includes("translate.googleapis.com")
  );
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (_) {
    if (request.mode === "navigate" || request.destination === "document") {
      return (await caches.match(OFFLINE_FALLBACK_URL)) || new Response("Offline", { status: 503 });
    }

    return new Response("", { status: 503, statusText: "Service Unavailable" });
  }
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response);
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const fallback = await caches.match(OFFLINE_FALLBACK_URL);
    if (fallback) return fallback;

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      await putInCache(RUNTIME_CACHE, request, response);
      return response;
    })
    .catch(() => null);

  event.waitUntil(networkPromise.then(() => undefined));

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  return new Response("", { status: 503, statusText: "Service Unavailable" });
}

async function cacheFirstWithLimit(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response);
    await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    return response;
  } catch (_) {
    return new Response("", { status: 503, statusText: "Service Unavailable" });
  }
}

async function networkFirstGeneric(request) {
  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response);
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const fallback = await caches.match(OFFLINE_FALLBACK_URL);
      if (fallback) return fallback;
    }

    return new Response("", { status: 503, statusText: "Service Unavailable" });
  }
}

async function putInCache(cacheName, request, response) {
  if (!shouldCache(request, response)) return;

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

function shouldCache(request, response) {
  if (request.method !== "GET") return false;
  if (!response || response.status !== 200) return false;

  const url = new URL(request.url);
  if (isNetworkOnlyRequest(url)) return false;

  return true;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= maxEntries) return;

  const overflow = keys.length - maxEntries;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}
