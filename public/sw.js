// Insta Vault — Service Worker minimaliste
// Sa seule mission : permettre l'installation PWA (Safari iOS exige un SW
// avec un fetch handler pour considérer une app comme installable).
// On ne cache QUE les assets statiques pour accélérer les chargements
// répétés. Tout le reste passe direct au serveur.

const CACHE_VERSION = "v8-minimal";
const STATIC_CACHE = `insta-vault-static-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("insta-vault-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache uniquement les assets statiques Next + icônes
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/apple-icon") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Pour tout le reste : on laisse le browser parler direct au serveur
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return cached || Response.error();
  }
}
