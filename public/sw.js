const CACHE_NAME = "ipaim-app-v1";

// Logo imprimé sur les reçus et certificats : il doit être disponible sans réseau,
// même sur un poste qui n'a encore jamais édité de document.
const LOGO = "/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([cache.add("/"), cache.add(LOGO).catch(() => undefined)]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

// Fichiers déjà chargés par la page avant que le service worker ne la contrôle.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        event.data.urls
          .filter((url) => typeof url === "string" && url.startsWith(`${self.location.origin}/_next/static/`))
          .map(async (url) => {
            if (!(await cache.match(url))) await cache.add(url).catch(() => undefined);
          }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/")),
      ),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/_next/image" ||
    url.pathname === "/sw.js" ||
    /\.(?:jpe?g|png|webp)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request).then((response) => {
          if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached ?? update;
      }),
    );
  }
});