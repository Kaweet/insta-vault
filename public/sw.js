// Insta Vault — Service Worker (offline shell)
// Stratégie : network-first pour les pages HTML, cache-first pour les assets
// statiques. Les routes /api/* et /auth/* ne sont jamais cachées.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `insta-vault-static-${CACHE_VERSION}`;
const PAGES_CACHE = `insta-vault-pages-${CACHE_VERSION}`;

// Page minimale servie quand on est offline ET pas de page en cache
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Insta Vault — hors ligne</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #fafafa;
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 24px; text-align: center; }
  h1 { margin: 16px 0 8px; font-size: 24px; }
  p { color: #a3a3a3; max-width: 320px; line-height: 1.5; }
  button { margin-top: 24px; background: #fafafa; color: #0a0a0a; border: none;
    padding: 12px 24px; border-radius: 999px; font-weight: 500; cursor: pointer; font-size: 14px; }
</style>
</head><body>
<div style="font-size:64px">💡</div>
<h1>Hors ligne</h1>
<p>Pas de connexion pour le moment. Reviens dès que tu retrouves le réseau.</p>
<button onclick="location.reload()">Réessayer</button>
</body></html>`;

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
              k !== PAGES_CACHE,
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

  // Ne JAMAIS cacher l'auth, les routes API, ou les websockets Supabase
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return; // laisse le browser gérer normalement
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

  // Documents HTML (navigations) : network-first avec fallback cache, puis offline
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Reste : network-first sans fallback offline
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || Response.error())),
  );
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

async function networkFirstHtml(req) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback : page hors ligne minimale
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
