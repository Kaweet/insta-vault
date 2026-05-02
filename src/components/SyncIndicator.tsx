"use client";

import { useEffect, useState } from "react";
import {
  getPendingCount,
  isReallyOnline,
  subscribeQueue,
} from "@/lib/offline-queue";

/**
 * Petit badge fixé en haut à droite quand des ops sont en attente de sync.
 * Affiche le nombre + état online/offline.
 *
 * On utilise isReallyOnline() (ping fetch) plutôt que navigator.onLine qui
 * ment sur Safari iOS (notamment en mode PWA).
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0);
  // On démarre optimiste (online) pour ne pas afficher un faux "Hors ligne"
  // au boot avant le premier ping
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshPending = () => {
      void getPendingCount().then(setPending);
    };
    const refreshOnline = () => {
      void isReallyOnline().then(setOnline);
    };

    refreshPending();
    refreshOnline();

    const unsub = subscribeQueue(refreshPending);
    const pendingInterval = setInterval(refreshPending, 5000);
    const onlineInterval = setInterval(refreshOnline, 15_000);

    // Au retour visibilité (PWA qui réveille), on re-check
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshPending();
        refreshOnline();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub();
      clearInterval(pendingInterval);
      clearInterval(onlineInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `🔌 Hors ligne · ${pending} en attente`
      : "🔌 Hors ligne"
    : `🔄 Sync ${pending}`;

  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-40 rounded-full bg-neutral-900/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur dark:bg-neutral-50/90 dark:text-neutral-900"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
