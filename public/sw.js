// Insta Vault — Service Worker offline-first
// Stratégie :
// - Précache les routes principales (/, /ideas, /categories) à l'install
// - Stale-while-revalidate pour ces routes (cache d'abord, réseau en arrière-plan)
// - Cache-first pour les assets statiques
// - Bypass complet pour /api/*, /auth/*, et les requêtes Supabase
//
// Les data Supabase (liste d'idées etc.) sont toujours fetchées en réseau :
// si offline, le fetch échoue silencieusement et la page affiche les seules
// idées locales (pending) + un bandeau hors ligne.

const CACHE_VERSION = "v5";
const STATIC_CACHE = `insta-vault-static-${CACHE_VERSION}`;
const SHELL_CACHE = `insta-vault-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = ["/", "/ideas", "/categories"];

// Routes dynamiques qu'on cache au moment du visit (pour offline ensuite)
const DYNAMIC_SHELL_PREFIXES = ["/ideas/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Précache best-effort : si un fetch fail, on ne bloque pas l'install
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "include" });
            if (res.ok) await cache.put(url, res);
          } catch {
            // ignore
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
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

  // Ne traite que GET
  if (req.method !== "GET") return;

  // Bypass requêtes externes (Supabase notamment) : data toujours réseau
  if (url.origin !== self.location.origin) return;

  // Bypass /api/* et /auth/*
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Bypass les fetches RSC (navigation client-side Next.js).
  // Ils contiennent des données live qu'on ne veut PAS cacher.
  if (
    url.search.includes("_rsc=") ||
    req.headers.get("RSC") ||
    req.headers.get("Next-Router-State-Tree") ||
    req.headers.get("Next-Router-Prefetch")
  ) {
    return;
  }

  // Assets statiques Next : cache-first
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

  // Navigations HTML : on cache toutes les routes pré-cachées + dynamiques shell
  const isHtmlNavigation =
    req.mode === "navigate" ||
    req.headers.get("accept")?.includes("text/html");

  if (isHtmlNavigation) {
    const isShellRoute = PRECACHE_URLS.includes(url.pathname);
    const isDynamicShell = DYNAMIC_SHELL_PREFIXES.some((p) =>
      url.pathname.startsWith(p),
    );
    if (isShellRoute || isDynamicShell) {
      event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
      return;
    }
  }

  // Le reste : pas de cache, le browser parle direct au serveur.
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
    networkPromise.catch(() => {});
    return cached;
  }
  const fresh = await networkPromise;
  return fresh || Response.error();
}
