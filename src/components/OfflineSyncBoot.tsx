"use client";

import { useEffect } from "react";
import { bootOfflineSync } from "@/lib/offline-queue";

/** Démarre la détection online/offline et l'auto-sync au mount. */
export function OfflineSyncBoot() {
  useEffect(() => {
    bootOfflineSync();
  }, []);
  return null;
}
