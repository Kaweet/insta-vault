// Insta Vault — Service Worker minimaliste
// Stratégie : on ne cache QUE les assets statiques (JS/CSS/icons).
// Tout le reste (pages HTML, RSC, API, auth) bypass le SW pour préserver
// les cookies et éviter de servir des réponses obsolètes.
// Le bénéfice principal : permettre l'installation PWA et accélérer les
// chargements répétés des assets statiques.

const CACHE_VERSION = "v3";
const STATIC_CACHE = `insta-vault-static-${CACHE_VERSION}`;
const SHELL_CACHE = `insta-vault-shell-${CACHE_VERSION}`;

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
          .filter(
            (k) =>
              k.startsWith("insta-vault-") &&
              k !== STATIC_CACHE &&
              k !== SHELL_CACHE,
          )
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

  // Page d'accueil "/" : stale-while-revalidate pour permettre l'ouverture
  // offline (mode avion). On exclut les RSC fetches (Next-Router-*) qui
  // doivent rester directs pour préserver l'auth.
  const isHomeNavigation =
    url.pathname === "/" &&
    !url.search.includes("_rsc=") &&
    !req.headers.get("RSC") &&
    !req.headers.get("Next-Router-State-Tree") &&
    !req.headers.get("Next-Router-Prefetch") &&
    (req.mode === "navigate" ||
      req.headers.get("accept")?.includes("text/html"));

  if (isHomeNavigation) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // Pour tout le reste : on ne touche pas.
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

/**
 * Sert le cache immédiatement si dispo (rapide + offline-friendly), met à
 * jour le cache en arrière-plan via le réseau. Si pas de cache ET pas de
 * réseau, on retourne une erreur (Safari affichera son écran natif).
 */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((fresh) => {
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  if (cached) {
    // Sert le cache, met à jour en background
    networkPromise.catch(() => {
      // ignore
    });
    return cached;
  }
  // Pas de cache : on attend le réseau
  const fresh = await networkPromise;
  return fresh || Response.error();
}
