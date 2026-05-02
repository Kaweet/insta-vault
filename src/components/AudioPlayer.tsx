"use client";

import { useEffect, useState } from "react";
import { getSignedAudioUrl } from "@/lib/media";
import type { Media } from "@/lib/types";

export function AudioPlayer({ media }: { media: Media }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storagePath = media.storage_path;

  useEffect(() => {
    if (!storagePath) return;
    let cancelled = false;
    getSignedAudioUrl(storagePath)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur de lecture");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!storagePath) {
    return <p className="text-xs text-red-500">Aucun fichier audio</p>;
  }
  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  if (!url) {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Chargement de l&apos;audio…
      </p>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={url}
      className="w-full"
    >
      Ton navigateur ne supporte pas la lecture audio.
    </audio>
  );
}
