"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listPending,
  subscribe,
  type PendingIdeaView,
} from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import type { Category, Idea, IdeaStatus } from "@/lib/types";

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Brouillon",
  preparing: "En préparation",
  published: "Publiée",
};
const STATUS_ORDER: IdeaStatus[] = ["draft", "preparing", "published"];

type View = "list" | "kanban";
type CategoryFilter = "all" | "none" | string;
type StatusFilter = "all" | IdeaStatus;

// Carte unifiée pour l'affichage : soit une vraie idée Supabase, soit une
// idée pending locale (rendue avec un statut/catégorie virtuels).
type AnyIdea =
  | { kind: "db"; idea: Idea }
  | { kind: "pending"; pending: PendingIdeaView };

export function IdeasList({
  initialIdeas,
  categories,
}: {
  initialIdeas: Idea[];
  categories: Category[];
}) {
  const [view, setView] = useState<View>("list");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dbIdeas, setDbIdeas] = useState<Idea[]>(initialIdeas);
  const [pending, setPending] = useState<PendingIdeaView[]>([]);

  // Refresh DB côté client : mount + visibility + sync events
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const fetchIdeas = async () => {
      try {
        const { data } = await supabase
          .from("ideas")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (!cancelled && data) setDbIdeas(data as Idea[]);
      } catch {
        // offline: on garde la liste précédente
      }
    };

    void fetchIdeas();
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchIdeas();
    };
    document.addEventListener("visibilitychange", onVisible);
    // subscribe au module offline : à chaque sync, refetch
    const unsub = subscribe(() => void fetchIdeas());
    return () => {
      cancelled = true;
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Refresh des pendings au mount + à chaque event subscribe
  useEffect(() => {
    const refresh = () => {
      void listPending().then(setPending);
    };
    refresh();
    return subscribe(refresh);
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const allIdeas: AnyIdea[] = useMemo(() => {
    const out: AnyIdea[] = [];
    for (const p of pending) out.push({ kind: "pending", pending: p });
    for (const i of dbIdeas) out.push({ kind: "db", idea: i });
    return out;
  }, [pending, dbIdeas]);

  const filtered = useMemo(() => {
    return allIdeas.filter((item) => {
      if (item.kind === "pending") {
        // Les pending n'ont pas de catégorie/statut — on les affiche toujours
        // sauf si un filtre statut autre que "all" est actif
        if (statusFilter !== "all" && statusFilter !== "draft") return false;
        if (categoryFilter !== "all" && categoryFilter !== "none") return false;
        return true;
      }
      const idea = item.idea;
      if (categoryFilter === "none" && idea.category_id !== null) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "none" &&
        idea.category_id !== categoryFilter
      )
        return false;
      if (statusFilter !== "all" && idea.status !== statusFilter) return false;
      return true;
    });
  }, [allIdeas, categoryFilter, statusFilter]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          <ViewBtn active={view === "list"} onClick={() => setView("list")}>
            Liste
          </ViewBtn>
          <ViewBtn active={view === "kanban"} onClick={() => setView("kanban")}>
            Kanban
          </ViewBtn>
        </div>
        <span className="text-xs text-neutral-400">
          {filtered.length} / {allIdeas.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        >
          Toutes
        </FilterPill>
        <FilterPill
          active={categoryFilter === "none"}
          onClick={() => setCategoryFilter("none")}
        >
          Sans catégorie
        </FilterPill>
        {categories.map((c) => (
          <FilterPill
            key={c.id}
            active={categoryFilter === c.id}
            onClick={() => setCategoryFilter(c.id)}
            color={c.color ?? undefined}
          >
            {c.name}
          </FilterPill>
        ))}
      </div>

      {view === "list" ? (
        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            Tous statuts
          </FilterPill>
          {STATUS_ORDER.map((s) => (
            <FilterPill
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]}
            </FilterPill>
          ))}
        </div>
      ) : null}

      {view === "list" ? (
        <ListView ideas={filtered} categoryById={categoryById} />
      ) : (
        <KanbanView ideas={filtered} categoryById={categoryById} />
      )}
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
          : "border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {children}
    </button>
  );
}

function ListView({
  ideas,
  categoryById,
}: {
  ideas: AnyIdea[];
  categoryById: Map<string, Category>;
}) {
  if (ideas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Aucune idée pour ces filtres.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ideas.map((item) => (
        <IdeaCard
          key={
            item.kind === "pending" ? `p-${item.pending.id}` : `d-${item.idea.id}`
          }
          item={item}
          categoryById={categoryById}
        />
      ))}
    </ul>
  );
}

function KanbanView({
  ideas,
  categoryById,
}: {
  ideas: AnyIdea[];
  categoryById: Map<string, Category>;
}) {
  const grouped: Record<IdeaStatus, AnyIdea[]> = {
    draft: [],
    preparing: [],
    published: [],
  };
  for (const item of ideas) {
    if (item.kind === "pending") grouped.draft.push(item);
    else grouped[item.idea.status].push(item);
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STATUS_ORDER.map((s) => (
        <div key={s} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
            {STATUS_LABELS[s]} ({grouped[s].length})
          </h3>
          <div className="flex flex-col gap-2">
            {grouped[s].length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
                —
              </p>
            ) : (
              grouped[s].map((item) => (
                <IdeaCard
                  key={
                    item.kind === "pending"
                      ? `p-${item.pending.id}`
                      : `d-${item.idea.id}`
                  }
                  item={item}
                  categoryById={categoryById}
                  compact
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function IdeaCard({
  item,
  categoryById,
  compact = false,
}: {
  item: AnyIdea;
  categoryById: Map<string, Category>;
  compact?: boolean;
}) {
  if (item.kind === "pending") {
    const p = item.pending;
    return (
      <li className="list-none">
        <div
          className="block cursor-default rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20"
          aria-label="Idée en attente de synchronisation"
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={`min-w-0 flex-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300 ${
                compact ? "line-clamp-2" : "line-clamp-3"
              }`}
            >
              {p.content || (
                <span className="italic text-neutral-400">
                  (audio sans transcription)
                </span>
              )}
            </p>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              ⏳ En attente
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
            <span>{p.transcriptionSource === "audio" ? "🎤" : "✍️"}</span>
            <span>
              {new Date(p.createdAt).toLocaleString("fr-FR", {
                dateStyle: "short",
              })}
            </span>
          </div>
        </div>
      </li>
    );
  }

  const idea = item.idea;
  const category = idea.category_id
    ? categoryById.get(idea.category_id)
    : undefined;

  return (
    <li className="list-none">
      <Link
        href={`/ideas/${idea.id}`}
        className="block rounded-2xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {idea.title ? (
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {idea.title}
          </p>
        ) : null}
        <p
          className={`whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300 ${
            compact ? "line-clamp-2" : "line-clamp-3"
          }`}
        >
          {idea.content || (
            <span className="italic text-neutral-400">
              (audio sans transcription)
            </span>
          )}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            {category ? (
              <span
                className="flex items-center gap-1"
                style={{ color: category.color ?? "#6b7280" }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: category.color ?? "#6b7280" }}
                />
                {category.name}
              </span>
            ) : null}
            <span>{idea.transcription_source === "audio" ? "🎤" : "✍️"}</span>
          </div>
          <span className="shrink-0">
            {new Date(idea.created_at).toLocaleString("fr-FR", {
              dateStyle: "short",
            })}
          </span>
        </div>
      </Link>
    </li>
  );
}
