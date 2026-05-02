// Insta Vault — Service Worker minimaliste
// Stratégie : on ne cache QUE les assets statiques (JS/CSS/icons).
// Tout le reste (pages HTML, RSC, API, auth) bypass le SW pour préserver
// les cookies et éviter de servir des réponses obsolètes.
// Le bénéfice principal : permettre l'installation PWA et accélérer les
// chargements répétés des assets statiques.

const CACHE_VERSION = "v2";
const STATIC_CACHE = `insta-vault-static-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nettoyer les anciens caches
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
  const url = new URL(req.url);

  // Ne traite que GET et same-origin
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Assets statiques Next : cache-first (sûrs, pas d'auth)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/apple-icon") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Pour tout le reste (HTML, RSC, API, auth) : on ne touche pas.
  // Le browser parle directement au serveur, cookies préservés.
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
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
