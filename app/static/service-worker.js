const CACHE_NAME = "pelada-manager-v18-edit-teams";
const CORE_ASSETS = [
  "/",
  "/static/pelapan-logo.png",
  "/static/react/manifest.json",
  "/static/react/index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (requestUrl.hostname.includes("wa.me") || requestUrl.hostname.includes("whatsapp")) {
    return;
  }

  if (request.method !== "GET" || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    }),
  );
});
