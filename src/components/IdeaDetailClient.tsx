"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IdeaEditor } from "@/components/IdeaEditor";
import { LocalIdeaEditor } from "@/components/LocalIdeaEditor";
import { createClient } from "@/lib/supabase/client";
import type { Category, Idea, Media } from "@/lib/types";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      idea: Idea;
      categories: Category[];
      audioMedia: Media[];
    }
  | { status: "not_found" }
  | { status: "offline" }
  | { status: "error"; message: string };

export function IdeaDetailClient({ ideaId }: { ideaId: string }) {
  const isLocal = ideaId.startsWith("local-");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [categories, setCategories] = useState<Category[]>([]);

  // Idée locale : on n'a besoin que des catégories pour l'éditeur
  useEffect(() => {
    if (!isLocal) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true });
        if (!cancelled) setCategories((data ?? []) as Category[]);
      } catch {
        // pas grave, on rendra avec catégories vides
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocal]);

  // Idée Supabase : on charge tout côté client
  useEffect(() => {
    if (isLocal) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const [ideaRes, categoriesRes, mediaRes] = await Promise.all([
          supabase.from("ideas").select("*").eq("id", ideaId).maybeSingle(),
          supabase
            .from("categories")
            .select("*")
            .order("name", { ascending: true }),
          supabase
            .from("media")
            .select("*")
            .eq("idea_id", ideaId)
            .eq("kind", "audio")
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        if (!ideaRes.data) {
          setState({ status: "not_found" });
          return;
        }
        setState({
          status: "ready",
          idea: ideaRes.data as Idea,
          categories: (categoriesRes.data ?? []) as Category[],
          audioMedia: (mediaRes.data ?? []) as Media[],
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const isNetwork =
          e instanceof TypeError ||
          /failed to fetch|network|offline|load failed/i.test(
            (e as { message?: string }).message ?? "",
          );
        setState(
          isNetwork
            ? { status: "offline" }
            : {
                status: "error",
                message: e instanceof Error ? e.message : "Erreur",
              },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocal, ideaId]);

  // Header commun
  const header = (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
      <Link
        href="/ideas"
        className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50"
      >
        ← Idées
      </Link>
      <h1 className="text-lg font-semibold tracking-tight">
        {isLocal ? "⏳ En attente" : "Édition"}
      </h1>
      <span className="w-12" />
    </header>
  );

  // Idée locale (IndexedDB) — toujours dispo offline
  if (isLocal) {
    return (
      <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
        {header}
        <LocalIdeaEditor ideaId={ideaId} categories={categories} />
      </main>
    );
  }

  // Idée Supabase
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      {header}
      {state.status === "loading" ? (
        <p className="mx-auto w-full max-w-2xl px-4 py-3 text-sm text-neutral-500">
          Chargement…
        </p>
      ) : state.status === "ready" ? (
        <IdeaEditor
          initialIdea={state.idea}
          categories={state.categories}
          audioMedia={state.audioMedia}
        />
      ) : state.status === "not_found" ? (
        <p className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800">
          Idée introuvable.
        </p>
      ) : state.status === "offline" ? (
        <p className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          📡 Hors ligne — cette idée sera disponible à la reconnexion.
        </p>
      ) : (
        <p className="mx-auto w-full max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </p>
      )}
    </main>
  );
}
