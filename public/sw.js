// Service Worker for PWA with Advanced Caching
const CACHE_VERSION = "v2";
const STATIC_CACHE = `swe-trendy-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `swe-trendy-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `swe-trendy-images-${CACHE_VERSION}`;
const API_CACHE = `swe-trendy-api-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/logo.jpg",
  "/new-arrivals",
  "/best-sellers",
  "/terms-and-conditions",
];

// Cache size limits
const MAX_IMAGE_CACHE_SIZE = 100;
const MAX_API_CACHE_SIZE = 50;
const MAX_DYNAMIC_CACHE_SIZE = 50;

// Install event - pre-cache static resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => console.error("[SW] Cache install failed:", err)),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        return self.clients.claim();
      }),
  );
});

// Helper: Limit cache size
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    console.log(
      `[SW] Trimming cache ${cacheName} from ${keys.length} to ${maxSize}`,
    );
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxSize);
  }
}

// Helper: Network-first strategy (for API calls)
async function networkFirst(request, cacheName, maxAge = 300000) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const clonedResponse = networkResponse.clone();

      // Add timestamp to track freshness
      const headers = new Headers(clonedResponse.headers);
      headers.set("sw-cache-time", Date.now().toString());

      const modifiedResponse = new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers,
      });

      cache.put(request, modifiedResponse);
      await limitCacheSize(cacheName, MAX_API_CACHE_SIZE);
    }
    return networkResponse;
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cache is too old
      const cacheTime = cachedResponse.headers.get("sw-cache-time");
      if (cacheTime && Date.now() - parseInt(cacheTime) > maxAge) {
        console.log("[SW] Cache expired for:", request.url);
      }
      return cachedResponse;
    }
    throw error;
  }
}

// Helper: Cache-first strategy (for images)
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_IMAGE_CACHE_SIZE);
    }
    return networkResponse;
  } catch (error) {
    console.error("[SW] Fetch failed for:", request.url);
    throw error;
  }
}

// Helper: Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(cacheName);
      cache.then((c) => c.put(request, networkResponse.clone()));
      limitCacheSize(cacheName, MAX_DYNAMIC_CACHE_SIZE);
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// Fetch event - intelligent routing
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // API routes - Network-first (fresh data preferred, 5min cache fallback)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 300000));
    return;
  }

  // Images from external CDNs - Cache-first (images rarely change)
  if (
    url.hostname.includes("cloudinary.com") ||
    url.hostname.includes("r2.cloudflarestorage.com") ||
    url.hostname.includes(".r2.dev") ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets - Cache-first
  if (
    url.pathname.match(/\.(css|js|woff2?|ttf|otf)$/i) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages - Stale-while-revalidate (show cached, update in background)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // Default - Network-first
  event.respondWith(networkFirst(request, DYNAMIC_CACHE, 60000));
});
