"use client";

import { useCallback, useState } from "react";
import { deleteIdea, updateIdeaContent } from "@/lib/ideas";
import type { Idea } from "@/lib/types";

type Toast = { id: number; kind: "ok" | "err"; message: string };

export function IdeasList({ initialIdeas }: { initialIdeas: Idea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);

  async function handleSaveEdit(idea: Idea, newContent: string) {
    try {
      const updated = await updateIdeaContent(idea.id, newContent.trim());
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? updated : i)),
      );
      pushToast("ok", "Idée modifiée ✓");
      return true;
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
      return false;
    }
  }

  async function handleDelete(idea: Idea) {
    try {
      await deleteIdea(idea.id);
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
      pushToast("ok", "Idée supprimée");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    }
  }

  if (ideas.length === 0) {
    return (
      <p className="mx-auto w-full max-w-2xl rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Aucune idée pour le moment.
      </p>
    );
  }

  return (
    <>
      <ul className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        {ideas.map((idea) => (
          <IdeaItem
            key={idea.id}
            idea={idea}
            onSaveEdit={(c) => handleSaveEdit(idea, c)}
            onDelete={() => handleDelete(idea)}
          />
        ))}
      </ul>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
                t.kind === "ok"
                  ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                  : "bg-red-500 text-white"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

type Mode = "view" | "edit" | "confirm-delete";

function IdeaItem({
  idea,
  onSaveEdit,
  onDelete,
}: {
  idea: Idea;
  onSaveEdit: (newContent: string) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(idea.content);
  const [busy, setBusy] = useState(false);

  if (mode === "edit") {
    return (
      <li className="rounded-2xl border border-neutral-300 bg-white px-5 py-4 dark:border-neutral-700 dark:bg-neutral-900">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.max(3, Math.min(10, draft.split("\n").length))}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(idea.content);
              setMode("view");
            }}
            disabled={busy}
            className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!draft.trim()) return;
              setBusy(true);
              const ok = await onSaveEdit(draft);
              setBusy(false);
              if (ok) setMode("view");
            }}
            disabled={busy || !draft.trim() || draft === idea.content}
            className="flex-1 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy ? "…" : "Sauver"}
          </button>
        </div>
      </li>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <li className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm text-neutral-900 dark:text-neutral-100">
          Supprimer cette idée ?
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
          {idea.content || "(audio sans transcription)"}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={busy}
            className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              await onDelete();
              // Le composant parent retire l'item, pas la peine de reset busy
            }}
            disabled={busy}
            className="flex-1 rounded-full bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "…" : "Supprimer"}
          </button>
        </div>
      </li>
    );
  }

  // mode === "view"
  return (
    <li className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-neutral-900 dark:text-neutral-100">
        {idea.content || "(audio sans transcription)"}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-400">
        <span className="truncate">
          {new Date(idea.created_at).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}{" "}
          · {idea.transcription_source === "audio" ? "🎤" : "✍️"} {idea.status}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(idea.content);
              setMode("edit");
            }}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  );
}
