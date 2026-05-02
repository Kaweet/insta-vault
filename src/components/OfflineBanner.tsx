"use client";

import { useEffect, useState } from "react";
import { isReallyOnline } from "@/lib/offline-queue";

/**
 * Petit bandeau affiché sur les pages liste quand le ping Supabase échoue.
 * Indique que les anciennes idées (côté DB) sont indisponibles tant qu'on
 * n'a pas le réseau.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      void isReallyOnline().then(setOnline);
    };
    refresh();
    const interval = setInterval(refresh, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
    >
      📡 Hors ligne — les anciennes idées seront visibles à la reconnexion. Tu
      peux quand même en capturer de nouvelles.
    </div>
  );
}
