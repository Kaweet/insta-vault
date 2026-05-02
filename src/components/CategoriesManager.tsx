"use client";

import { useCallback, useState } from "react";
import {
  CATEGORY_COLORS,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories";
import type { Category } from "@/lib/types";

type Toast = { id: number; kind: "ok" | "err"; message: string };

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0].hex);
  const [creating, setCreating] = useState(false);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);

  async function onCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cat = await createCategory({ name: newName, color: newColor });
      setCategories((prev) =>
        [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      pushToast("ok", "Catégorie créée ✓");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function onUpdate(id: string, patch: { name?: string; color?: string }) {
    try {
      const updated = await updateCategory(id, patch);
      setCategories((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      pushToast("ok", "Catégorie modifiée ✓");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      pushToast("ok", "Catégorie supprimée");
    } catch (e) {
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <>
      {/* Création */}
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold">Nouvelle catégorie</h2>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ex: Mode, Voyage, Lifestyle…"
          maxLength={40}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
        />
        <ColorPalette selected={newColor} onSelect={setNewColor} />
        <button
          type="button"
          onClick={onCreate}
          disabled={!newName.trim() || creating}
          className="mt-3 w-full rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {creating ? "…" : "+ Créer"}
        </button>
      </section>

      {/* Liste */}
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
          {categories.length} catégorie{categories.length > 1 ? "s" : ""}
        </h2>
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-6 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Aucune catégorie pour le moment.
          </p>
        ) : (
          categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onUpdate={(patch) => onUpdate(cat.id, patch)}
              onDelete={() => onDelete(cat.id)}
            />
          ))
        )}
      </section>

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
    </>
  );
}

function ColorPalette({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          onClick={() => onSelect(c.hex)}
          aria-label={c.name}
          className={`h-7 w-7 rounded-full transition ${
            selected === c.hex
              ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white dark:ring-neutral-50 dark:ring-offset-neutral-900"
              : ""
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

type RowMode = "view" | "edit" | "confirm-delete";

function CategoryRow({
  category,
  onUpdate,
  onDelete,
}: {
  category: Category;
  onUpdate: (patch: { name?: string; color?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [mode, setMode] = useState<RowMode>("view");
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState<string>(
    category.color ?? CATEGORY_COLORS[0].hex,
  );
  const [busy, setBusy] = useState(false);

  if (mode === "edit") {
    return (
      <div className="rounded-2xl border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500 dark:focus:ring-neutral-700"
        />
        <ColorPalette selected={color} onSelect={setColor} />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setName(category.name);
              setColor(category.color ?? CATEGORY_COLORS[0].hex);
              setMode("view");
            }}
            disabled={busy}
            className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!name.trim()) return;
              setBusy(true);
              await onUpdate({ name, color });
              setBusy(false);
              setMode("view");
            }}
            disabled={
              busy ||
              !name.trim() ||
              (name === category.name && color === category.color)
            }
            className="flex-1 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy ? "…" : "Sauver"}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm">
          Supprimer <strong>{category.name}</strong> ?
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Les idées rattachées ne seront pas supprimées (la catégorie sera juste
          détachée).
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={busy}
            className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              await onDelete();
            }}
            disabled={busy}
            className="flex-1 rounded-full bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "…" : "Supprimer"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <span
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? "#6b7280" }}
        />
        <span className="text-sm font-medium">{category.name}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setName(category.name);
            setColor(category.color ?? CATEGORY_COLORS[0].hex);
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
          Suppr.
        </button>
      </div>
    </div>
  );
}
