"use client";

import { useEffect } from "react";
import { bootOffline } from "@/lib/offline";

export function OfflineSyncBoot() {
  useEffect(() => {
    bootOffline();
  }, []);
  return null;
}
