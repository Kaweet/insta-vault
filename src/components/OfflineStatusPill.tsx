"use client";

import { useCallback, useEffect, useState } from "react";
import { getPendingCount, subscribe, syncNow } from "@/lib/offline";

/**
 * Pastille fixée en haut à droite. Affiche le nombre d'idées en attente
 * de sync. Tap pour forcer un sync. Disparaît si rien à sync.
 */
export function OfflineStatusPill() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      void getPendingCount().then(setPending);
    };
    refresh();
    return subscribe(refresh);
  }, []);

  const onTap = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }, []);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={syncing}
      className="fixed right-3 top-3 z-40 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white shadow-lg active:scale-95 disabled:opacity-70"
      aria-live="polite"
    >
      {syncing ? `Sync…` : `⏳ ${pending} en attente`}
    </button>
  );
}
