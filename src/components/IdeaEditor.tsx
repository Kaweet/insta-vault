"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioPlayer } from "@/components/AudioPlayer";
import { aiCategorize, aiRewrite, type RewriteResult } from "@/lib/ai";
import { deleteIdea, updateIdea } from "@/lib/ideas";
import type { Category, Idea, IdeaStatus, Media } from "@/lib/types";

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "💡 Brouillon",
  preparing: "✏️ En préparation",
  published: "✅ Publiée",
};

type Toast = { id: number; kind: "ok" | "err"; message: string };

export function IdeaEditor({
  initialIdea,
  categories,
  audioMedia,
}: {
  initialIdea: Idea;
  categories: Category[];
  audioMedia: Media[];
}) {
  const router = useRouter();
  const [idea, setIdea] = useState(initialIdea);
  const [title, setTitle] = useState(initialIdea.title ?? "");
  const [content, setContent] = useState(initialIdea.content);
  const [categoryId, setCategoryId] = useState(initialIdea.category_id);
  const [status, setStatus] = useState<IdeaStatus>(initialIdea.status);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // IA
  const [aiBusy, setAiBusy] = useState<null | "categorize" | "rewrite">(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(
    initialIdea.ai_caption || initialIdea.ai_hashtags?.length
      ? {
          title: initialIdea.title ?? "",
          caption: initialIdea.ai_caption ?? "",
          hashtags: initialIdea.ai_hashtags ?? [],
        }
      : null,
  );

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);

  const dirty =
    (title || null) !== (idea.title ?? null) ||
    content !== idea.content ||
    categoryId !== idea.category_id ||
    status !== idea.status;

  async function onSave() {
    if (!dirty) return;
    setBusy(true);
    try {
      const updated = await updateIdea(idea.id, {
        title: title.trim() || null,
        content: content.trim(),
        category_id: categoryId,
        status,
      });
      setIdea(updated);
      pushToast("ok", "Idée enregistrée ✓");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // Quick status change with auto-save
  async function onStatusChange(newStatus: IdeaStatus) {
    setStatus(newStatus);
    if (newStatus === idea.status) return;
    try {
      const updated = await updateIdea(idea.id, { status: newStatus });
      setIdea(updated);
      pushToast("ok", `Statut: ${STATUS_LABELS[newStatus]}`);
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onAiCategorize() {
    if (!content.trim() || categories.length === 0) return;
    setAiBusy("categorize");
    try {
      const r = await aiCategorize(
        content.trim(),
        categories.map((c) => ({ id: c.id, name: c.name })),
      );
      if (r.category_id) {
        setCategoryId(r.category_id);
        const cat = categories.find((c) => c.id === r.category_id);
        pushToast("ok", `Catégorie suggérée: ${cat?.name ?? "?"}`);
      } else {
        pushToast("err", "Aucune catégorie ne correspond vraiment");
      }
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setAiBusy(null);
    }
  }

  async function onAiRewrite() {
    if (!content.trim()) return;
    setAiBusy("rewrite");
    try {
      const r = await aiRewrite(content.trim());
      setRewriteResult(r);
      // Sauve directement le résultat dans la DB pour persister entre rechargements
      try {
        await updateIdea(idea.id, {
          ai_caption: r.caption,
          ai_hashtags: r.hashtags,
        } as never);
      } catch {
        // pas grave si l'update fail (l'utilisatrice garde le résultat à l'écran)
      }
      pushToast("ok", "Reformulation prête ✨");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setAiBusy(null);
    }
  }

  function applyRewriteTitle() {
    if (rewriteResult?.title) setTitle(rewriteResult.title);
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("ok", `${label} copié 📋`);
    } catch {
      pushToast("err", "Copie impossible");
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteIdea(idea.id);
      router.push("/ideas");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Titre */}
      <div>
        <label className="mb-1 block px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Titre (optionnel)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Donne un titre à cette idée"
          maxLength={120}
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600 dark:focus:ring-neutral-700"
        />
      </div>

      {/* Contenu */}
      <div>
        <label className="mb-1 block px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Contenu
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={Math.max(6, Math.min(20, content.split("\n").length + 1))}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600 dark:focus:ring-neutral-700"
        />
      </div>

      {/* IA */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 dark:border-neutral-800 dark:from-violet-950/30 dark:to-fuchsia-950/30">
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-violet-700 dark:text-violet-400">
          ✨ Assistant IA
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAiRewrite}
            disabled={!content.trim() || aiBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700 dark:bg-neutral-900 dark:text-violet-300 dark:hover:bg-violet-950/30"
          >
            {aiBusy === "rewrite" ? "…" : "✨ Reformuler en post Insta"}
          </button>
          <button
            type="button"
            onClick={onAiCategorize}
            disabled={
              !content.trim() || categories.length === 0 || aiBusy !== null
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700 dark:bg-neutral-900 dark:text-violet-300 dark:hover:bg-violet-950/30"
          >
            {aiBusy === "categorize" ? "…" : "🏷️ Suggérer une catégorie"}
          </button>
        </div>

        {rewriteResult ? (
          <div className="mt-4 flex flex-col gap-3">
            {/* Title suggestion */}
            {rewriteResult.title ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-medium text-neutral-500">
                  Titre suggéré
                </p>
                <p className="mt-1 text-sm font-medium">
                  {rewriteResult.title}
                </p>
                <button
                  type="button"
                  onClick={applyRewriteTitle}
                  className="mt-2 text-xs font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900 dark:text-violet-400"
                >
                  Appliquer ce titre
                </button>
              </div>
            ) : null}

            {/* Caption */}
            <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-neutral-500">
                  Caption
                </p>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(rewriteResult.caption, "Caption")
                  }
                  className="shrink-0 text-xs font-medium text-violet-700 underline underline-offset-4 dark:text-violet-400"
                >
                  Copier
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {rewriteResult.caption}
              </p>
            </div>

            {/* Hashtags */}
            {rewriteResult.hashtags.length > 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-neutral-500">
                    Hashtags ({rewriteResult.hashtags.length})
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        rewriteResult.hashtags.map((h) => `#${h}`).join(" "),
                        "Hashtags",
                      )
                    }
                    className="shrink-0 text-xs font-medium text-violet-700 underline underline-offset-4 dark:text-violet-400"
                  >
                    Copier
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rewriteResult.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Audio */}
      {audioMedia.length > 0 ? (
        <div>
          <label className="mb-1 block px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Audio ({audioMedia.length})
          </label>
          <div className="flex flex-col gap-2">
            {audioMedia.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <AudioPlayer media={m} />
                <p className="mt-1 text-xs text-neutral-400">
                  {m.duration_ms
                    ? `${Math.round(m.duration_ms / 1000)}s`
                    : ""}{" "}
                  · {new Date(m.created_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Catégorie */}
      <div>
        <label className="mb-1 block px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Catégorie
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              categoryId === null
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            Aucune
          </button>
          {categories.map((c) => {
            const selected = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                    : "border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color ?? "#6b7280" }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
        {categories.length === 0 ? (
          <p className="mt-2 px-1 text-xs text-neutral-400">
            Aucune catégorie. Crée-en sur la page Catégories.
          </p>
        ) : null}
      </div>

      {/* Statut */}
      <div>
        <label className="mb-1 block px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Statut
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STATUS_LABELS) as IdeaStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusChange(s)}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                status === s
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                  : "border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || busy}
          className="flex-1 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {busy ? "…" : dirty ? "Sauver les modifications" : "À jour ✓"}
        </button>
      </div>

      {/* Delete */}
      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {confirmingDelete ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-sm">Supprimer définitivement cette idée ?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="flex-1 rounded-full bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs font-medium text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Supprimer cette idée
          </button>
        )}
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 flex justify-center px-4">
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
    </div>
  );
}
