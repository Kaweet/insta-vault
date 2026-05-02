"use client";

/**
 * Offline minimal pour Insta Vault.
 *
 * Scope :
 * - Capture d'idées hors ligne (texte + audio) → stockage IndexedDB
 * - Sync automatique au retour réseau
 * - Modification/suppression de ces idées pending depuis l'UI client (in-memory)
 * - PAS de cache de la liste Supabase, PAS d'édition d'idées Supabase offline
 *
 * Tout passe par UNE seule API exposée (`saveIdea`, `listPending`,
 * `deletePending`, `subscribe`, `syncNow`), pas de double système.
 */

import { createClient } from "@/lib/supabase/client";
import type { Idea } from "@/lib/types";

// ============================================================
// IndexedDB minimal
// ============================================================

const DB_NAME = "insta-vault-offline-v2";
const DB_VERSION = 1;
const STORE = "pending_ideas";

type PendingIdea = {
  id: string; // local id (uuid)
  content: string;
  transcriptionSource: "text" | "audio";
  audio?: { blob: Blob; mimeType: string; durationMs: number };
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function dbPut(item: PendingIdea): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(): Promise<PendingIdea[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingIdea[]);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// Utils
// ============================================================

function newLocalId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `local-${rand}`;
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = (e as { message?: string }).message ?? "";
  return /failed to fetch|network|offline|timeout|load failed/i.test(msg);
}

function withTimeout<T>(thenable: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new TypeError("timeout")), ms);
    Promise.resolve(thenable).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ============================================================
// API publique : capture d'idée
// ============================================================

export type SaveResult =
  | { kind: "saved"; idea: Idea } // sync direct OK
  | { kind: "pending"; id: string }; // bascule en queue locale

/**
 * Tente de sauvegarder une idée online. Si le réseau échoue dans les 4s,
 * stocke localement et renvoie un id pending. La sync auto se chargera
 * de la pousser plus tard.
 */
export async function saveIdea(input: {
  content: string;
  transcriptionSource: "text" | "audio";
  audio?: { blob: Blob; mimeType: string; durationMs: number };
}): Promise<SaveResult> {
  const supabase = createClient();
  try {
    const userResult = await withTimeout(supabase.auth.getUser(), 3000);
    const user = userResult.data.user;
    if (!user) throw new TypeError("auth missing");

    const { data, error } = await withTimeout(
      supabase
        .from("ideas")
        .insert({
          user_id: user.id,
          content: input.content,
          transcription_source: input.transcriptionSource,
          status: "draft",
        })
        .select()
        .single(),
      4000,
    );
    if (error) throw error;
    const idea = data as Idea;

    // Idée créée, on tente l'audio. Si échec, l'idée existe quand même
    // côté DB, on perd juste l'audio (cas extrêmement rare).
    if (input.audio) {
      try {
        await withTimeout(
          uploadAudio(idea.id, user.id, input.audio),
          8000,
        );
      } catch {
        // on log silencieusement, l'idée reste en DB
      }
    }
    notify();
    return { kind: "saved", idea };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    // Réseau KO : on stocke en local
    const id = newLocalId();
    await dbPut({
      id,
      content: input.content,
      transcriptionSource: input.transcriptionSource,
      audio: input.audio,
      createdAt: Date.now(),
    });
    notify();
    return { kind: "pending", id };
  }
}

async function uploadAudio(
  ideaId: string,
  userId: string,
  audio: { blob: Blob; mimeType: string; durationMs: number },
): Promise<void> {
  const supabase = createClient();
  const ext = audio.mimeType.includes("webm")
    ? "webm"
    : audio.mimeType.includes("mp4")
      ? "m4a"
      : audio.mimeType.includes("ogg")
        ? "ogg"
        : "bin";
  const path = `${userId}/${ideaId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("insta-vault-audio")
    .upload(path, audio.blob, {
      contentType: audio.mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const { error: mediaError } = await supabase.from("media").insert({
    idea_id: ideaId,
    user_id: userId,
    kind: "audio",
    storage_path: path,
    mime_type: audio.mimeType,
    duration_ms: audio.durationMs,
  });
  if (mediaError) throw mediaError;
}

// ============================================================
// API publique : gérer les idées pending
// ============================================================

export type PendingIdeaView = {
  id: string;
  content: string;
  transcriptionSource: "text" | "audio";
  hasAudio: boolean;
  createdAt: number;
};

export async function listPending(): Promise<PendingIdeaView[]> {
  const all = await dbGetAll();
  return all
    .map((p) => ({
      id: p.id,
      content: p.content,
      transcriptionSource: p.transcriptionSource,
      hasAudio: !!p.audio,
      createdAt: p.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updatePendingContent(
  id: string,
  content: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      const existing = get.result as PendingIdea | undefined;
      if (!existing) {
        resolve();
        return;
      }
      store.put({ ...existing, content });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

export async function deletePending(id: string): Promise<void> {
  await dbDelete(id);
  notify();
}

export async function getPendingCount(): Promise<number> {
  return (await dbGetAll()).length;
}

// ============================================================
// Sync engine
// ============================================================

let isSyncing = false;

export type SyncResult = { synced: number; failed: number };

export async function syncNow(): Promise<SyncResult> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const supabase = createClient();
    const userResult = await withTimeout(supabase.auth.getUser(), 3000).catch(
      () => null,
    );
    const user = userResult?.data.user;
    if (!user) {
      // Pas authentifié ou réseau KO : on retentera plus tard
      return { synced: 0, failed: 0 };
    }

    const items = await dbGetAll();
    items.sort((a, b) => a.createdAt - b.createdAt);

    for (const item of items) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("ideas")
            .insert({
              user_id: user.id,
              content: item.content,
              transcription_source: item.transcriptionSource,
              status: "draft",
            })
            .select()
            .single(),
          5000,
        );
        if (error) throw error;
        const idea = data as Idea;

        if (item.audio) {
          try {
            await withTimeout(uploadAudio(idea.id, user.id, item.audio), 10000);
          } catch {
            // on garde l'idée DB, on perd l'audio (rare)
          }
        }

        await dbDelete(item.id);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) break; // on reste là, on retentera
        // Erreur permanente (RLS, payload invalide…) : on supprime l'item
        // mais on note l'échec
        await dbDelete(item.id);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
    if (synced > 0 || failed > 0) notify();
  }
  return { synced, failed };
}

// ============================================================
// Subscriptions / notifications
// ============================================================

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

// ============================================================
// Boot
// ============================================================

let booted = false;

export function bootOffline() {
  if (booted) return;
  booted = true;
  if (typeof window === "undefined") return;

  const trigger = () => {
    void syncNow();
  };

  // Au boot après 1.5s (laisse le temps à l'auth de s'établir)
  setTimeout(trigger, 1500);

  // À chaque retour online
  window.addEventListener("online", trigger);

  // À chaque retour de visibilité (sortie de veille)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });

  // Polling doux toutes les 60s
  setInterval(trigger, 60_000);
}
