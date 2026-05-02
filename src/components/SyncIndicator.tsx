"use client";

import { useEffect, useState } from "react";
import { getPendingCount, subscribeQueue } from "@/lib/offline-queue";

/**
 * Petit badge fixé en haut à droite quand des ops sont en attente de sync.
 * Affiche le nombre + état online/offline.
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0);
  // Initialise l'état online directement (pas dans un useEffect)
  const [online, setOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      void getPendingCount().then(setPending);
    };
    refresh();

    const unsub = subscribeQueue(refresh);
    const onUp = () => {
      setOnline(true);
      refresh();
    };
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    const interval = setInterval(refresh, 5000);

    return () => {
      unsub();
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
      clearInterval(interval);
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
