// Service worker de l'espace étudiant (périmètre /etudiant uniquement).
// Les pages et les fichiers de l'application restent disponibles sans réseau ;
// les données, elles, sont gardées par l'application (dernière version reçue).
const CACHE = "ipaim-etudiant-v2";
const SHELL = ["/etudiant", "/etudiant.webmanifest", "/etudiant/icon-192.png", "/etudiant/icon-512.png", "/etudiant/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ipaim-etudiant-") && key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Fichiers chargés avant que le service worker ne contrôle la page.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
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

  // Pages : le réseau d'abord, la dernière version connue sans réseau.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/etudiant")) ?? Response.error()),
    );
    return;
  }

  // Fichiers de l'application : ce qui est en cache tout de suite, rafraîchi derrière.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/etudiant/") || url.pathname === "/etudiant.webmanifest") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? update;
      }),
    );
  }
});

// Notifications push : une annonce arrive même application fermée.
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  const title = message.title || "IPAIM Étudiant";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: message.body || "Nouvelle annonce de l'administration.",
      icon: "/etudiant/icon-192.png",
      badge: "/etudiant/badge-96.png",
      tag: message.tag || "annonce",
      renotify: true,
      lang: "fr",
      data: { url: message.url || "/etudiant/annonces" },
    }),
  );
});

// Un toucher sur la notification ouvre (ou ramène) l'application sur les messages.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/etudiant/annonces", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(`${self.location.origin}/etudiant`));
      if (open) {
        open.focus();
        return open.navigate(target).catch(() => undefined);
      }
      return self.clients.openWindow(target);
    }),
  );
});
