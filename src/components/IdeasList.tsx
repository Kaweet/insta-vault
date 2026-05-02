"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getLocalPendingIdeas,
  subscribeQueue,
  type LocalIdea,
} from "@/lib/offline-queue";
import type { Category, Idea, IdeaStatus } from "@/lib/types";

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Brouillon",
  preparing: "En préparation",
  published: "Publiée",
};
const STATUS_ORDER: IdeaStatus[] = ["draft", "preparing", "published"];

type View = "list" | "kanban";
type CategoryFilter = "all" | "none" | string; // "all", "none", or category id
type StatusFilter = "all" | IdeaStatus;

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
  const [pendingLocal, setPendingLocal] = useState<LocalIdea[]>([]);

  // Charge les idées pending locales et s'abonne aux changements de la queue
  useEffect(() => {
    const refresh = () => {
      void getLocalPendingIdeas().then(setPendingLocal);
    };
    refresh();
    return subscribeQueue(refresh);
  }, []);

  // Combine pending (en tête, plus récent) + idées DB. Dédoublonne par id.
  const allIdeas = useMemo(() => {
    const seen = new Set<string>();
    const combined: (Idea | LocalIdea)[] = [];
    for (const i of pendingLocal) {
      if (!seen.has(i.id)) {
        combined.push(i);
        seen.add(i.id);
      }
    }
    for (const i of initialIdeas) {
      if (!seen.has(i.id)) {
        combined.push(i);
        seen.add(i.id);
      }
    }
    return combined;
  }, [pendingLocal, initialIdeas]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const filtered = useMemo(() => {
    return allIdeas.filter((idea) => {
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
      {/* View toggle */}
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

      {/* Category filter */}
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

      {/* Status filter (only in list view, kanban shows columns) */}
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

      {/* Content */}
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
  ideas: (Idea | LocalIdea)[];
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
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          category={
            idea.category_id ? categoryById.get(idea.category_id) : undefined
          }
        />
      ))}
    </ul>
  );
}

function KanbanView({
  ideas,
  categoryById,
}: {
  ideas: (Idea | LocalIdea)[];
  categoryById: Map<string, Category>;
}) {
  const grouped: Record<IdeaStatus, (Idea | LocalIdea)[]> = {
    draft: [],
    preparing: [],
    published: [],
  };
  for (const idea of ideas) grouped[idea.status].push(idea);

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
              grouped[s].map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  category={
                    idea.category_id
                      ? categoryById.get(idea.category_id)
                      : undefined
                  }
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
  idea,
  category,
  compact = false,
}: {
  idea: Idea | LocalIdea;
  category?: Category;
  compact?: boolean;
}) {
  const isPending = "_pending" in idea && idea._pending === true;
  const innerContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
        </div>
        {isPending ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            ⏳ En attente
          </span>
        ) : null}
      </div>
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
    </>
  );

  return (
    <li className="list-none">
      <Link
        href={`/ideas/${idea.id}`}
        className={`block rounded-2xl border px-4 py-3 transition ${
          isPending
            ? "border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:border-amber-800 dark:hover:bg-amber-950/40"
            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
        }`}
      >
        {innerContent}
      </Link>
    </li>
  );
}
