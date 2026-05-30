const CACHE_NAME = "bbmmabb-v1";
const PRE_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

// ---------- install: precache core assets ----------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] precache failed:", err))
  );
});

// ---------- activate: purge old caches ----------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- fetch: stale-while-revalidate ----------
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Skip chrome-extension and other non-http(s) requests
  if (!e.request.url.startsWith("http")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));

      return cached || fetchPromise;
    })
  );
});
