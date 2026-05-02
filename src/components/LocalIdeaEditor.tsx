"use client";

import { useEffect, useState } from "react";
import { IdeaEditor } from "@/components/IdeaEditor";
import { STORES, getItem } from "@/lib/offline-store";
import type { LocalIdea } from "@/lib/offline-queue";
import type { Category, Idea } from "@/lib/types";

/**
 * Charge une idée locale (encore non synchronisée) depuis IndexedDB
 * et la passe à IdeaEditor. Permet d'éditer/supprimer offline.
 */
export function LocalIdeaEditor({
  ideaId,
  categories,
}: {
  ideaId: string;
  categories: Category[];
}) {
  const [idea, setIdea] = useState<LocalIdea | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getItem<LocalIdea>(STORES.ideas, ideaId)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setError(
            "Idée locale introuvable. Elle a peut-être déjà été synchronisée — recharge la liste.",
          );
        } else {
          setIdea(found);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur de chargement");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  if (error) {
    return (
      <p className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </p>
    );
  }

  if (!idea) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-3 text-sm text-neutral-500">
        Chargement…
      </p>
    );
  }

  // On reuse IdeaEditor : il appelle queuedUpdateIdea / queuedDeleteIdea
  // qui savent déjà gérer les ids "local-*"
  return (
    <IdeaEditor
      initialIdea={idea as Idea}
      categories={categories}
      audioMedia={[]} // pas d'audio backup affichable pour les locaux (le blob est en IndexedDB)
    />
  );
}
