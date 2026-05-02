"use client";

import { useEffect, useState } from "react";
import { subscribeSynced, type SyncedIdeaEvent } from "@/lib/offline-queue";

type Toast = { id: number; message: string };

/**
 * Toast global qui apparaît brièvement quand une idée vient d'être synchronisée
 * depuis la queue offline. Posé en bas, au-dessus de la BottomNav.
 */
export function SyncedToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeSynced((e: SyncedIdeaEvent) => {
      const id = e.at;
      setToasts((prev) => [
        ...prev,
        { id, message: "Idée synchronisée ✓" },
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
