"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioPlayer } from "@/components/AudioPlayer";
import { deleteIdea, updateIdea } from "@/lib/ideas";
import type { Category, Idea, IdeaStatus, Media } from "@/lib/types";

// Panneau IA caché temporairement (cf. décision 2026-05-02). Pour réactiver,
// décommenter les imports + le bloc IA dans le JSX et la logique aiCategorize/aiRewrite.
// import { aiCategorize, aiRewrite, type RewriteResult } from "@/lib/ai";

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
  const [hook, setHook] = useState(initialIdea.hook ?? "");
  const [content, setContent] = useState(initialIdea.content);
  const [caption, setCaption] = useState(initialIdea.caption ?? "");
  const [categoryId, setCategoryId] = useState(initialIdea.category_id);
  const [status, setStatus] = useState<IdeaStatus>(initialIdea.status);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);

  async function copyToClipboard(text: string, label: string) {
    if (!text.trim()) {
      pushToast("err", `${label} vide`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      pushToast("ok", `${label} copié 📋`);
    } catch {
      pushToast("err", "Copie impossible");
    }
  }

  const dirty =
    (title || null) !== (idea.title ?? null) ||
    (hook || null) !== (idea.hook ?? null) ||
    content !== idea.content ||
    (caption || null) !== (idea.caption ?? null) ||
    categoryId !== idea.category_id ||
    status !== idea.status;

  async function onSave() {
    if (!dirty) return;
    setBusy(true);
    try {
      const patch = {
        title: title.trim() || null,
        hook: hook.trim() || null,
        content: content.trim(),
        caption: caption.trim() || null,
        category_id: categoryId,
        status,
      };
      await updateIdea(idea.id, patch);
      // Update local optimiste pour que `dirty` repasse à false
      setIdea((prev) => ({
        ...prev,
        ...patch,
        updated_at: new Date().toISOString(),
      }));
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
      await updateIdea(idea.id, { status: newStatus });
      setIdea((prev) => ({ ...prev, status: newStatus }));
      pushToast("ok", `Statut: ${STATUS_LABELS[newStatus]}`);
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
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

      {/* Hook */}
      <FieldBlock
        label="Hook"
        value={hook}
        onChange={setHook}
        onCopy={() => copyToClipboard(hook, "Hook")}
        rows={3}
      />

      {/* Contenu */}
      <FieldBlock
        label="Contenu"
        value={content}
        onChange={setContent}
        onCopy={() => copyToClipboard(content, "Contenu")}
        rows={Math.max(6, Math.min(20, content.split("\n").length + 1))}
      />

      {/* Caption */}
      <FieldBlock
        label="Caption"
        value={caption}
        onChange={setCaption}
        onCopy={() => copyToClipboard(caption, "Caption")}
        rows={4}
      />

      {/* Tout copier */}
      <button
        type="button"
        onClick={() => {
          const all = [
            hook.trim() && `${hook.trim()}`,
            content.trim() && `${content.trim()}`,
            caption.trim() && `${caption.trim()}`,
          ]
            .filter(Boolean)
            .join("\n\n");
          void copyToClipboard(all, "Tout");
        }}
        disabled={!hook.trim() && !content.trim() && !caption.trim()}
        className="self-end rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        📋 Tout copier
      </button>

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

function FieldBlock({
  label,
  value,
  onChange,
  onCopy,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCopy: () => void;
  rows: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {label}
        </label>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value.trim()}
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900 disabled:opacity-40 disabled:no-underline dark:text-neutral-400 dark:hover:text-neutral-50"
        >
          Copier
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600 dark:focus:ring-neutral-700"
      />
    </div>
  );
}
