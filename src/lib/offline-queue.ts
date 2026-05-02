"use client";

import { createClient } from "@/lib/supabase/client";
import {
  STORES,
  countStore,
  deleteItem,
  getAll,
  getItem,
  putItem,
} from "@/lib/offline-store";
import type { Idea, IdeaStatus } from "@/lib/types";

// ============================================================
// Types
// ============================================================

export type PendingOp =
  | {
      kind: "create_idea";
      id: string;
      createdAt: number;
      payload: {
        localId: string;
        content: string;
        transcriptionSource: "text" | "audio";
        audioRef?: string;
      };
    }
  | {
      kind: "update_idea";
      id: string;
      createdAt: number;
      payload: {
        ideaId: string; // realId Supabase OU localId si pas encore syncé
        patch: {
          title?: string | null;
          hook?: string | null;
          content?: string;
          caption?: string | null;
          category_id?: string | null;
          status?: IdeaStatus;
          ai_caption?: string | null;
          ai_hashtags?: string[] | null;
        };
      };
    }
  | {
      kind: "delete_idea";
      id: string;
      createdAt: number;
      payload: {
        ideaId: string;
      };
    }
  | {
      kind: "upload_audio";
      id: string;
      createdAt: number;
      payload: {
        ideaId: string; // realId Supabase OU localId
        audioRef: string;
      };
    };

export type LocalIdea = Idea & {
  _pending?: boolean;
};

export type LocalAudio = {
  id: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: number;
};

const LOCAL_PREFIX = "local-";

// ============================================================
// Helpers
// ============================================================

function newOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newLocalId(): string {
  // Toujours préfixé pour distinguer des UUID Supabase
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${LOCAL_PREFIX}${rand}`;
}

function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof TypeError) return true; // fetch jette TypeError quand offline
  const msg = (e as { message?: string }).message ?? "";
  return /failed to fetch|network|offline|timeout|load failed/i.test(msg);
}

/**
 * Détecteur réseau fiable basé sur un fetch réel (pas navigator.onLine,
 * qui ment notamment dans les PWA Safari iOS). Renvoie true si on peut
 * vraiment joindre Supabase.
 */
let lastPingResult: boolean | null = null;
let lastPingAt = 0;

export async function isReallyOnline(): Promise<boolean> {
  // Cache 5s pour éviter de spammer
  const now = Date.now();
  if (lastPingResult !== null && now - lastPingAt < 5000) {
    return lastPingResult;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    // /auth/v1/health avec l'apikey (Supabase l'exige même pour le health)
    const res = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { apikey: anonKey },
    });
    clearTimeout(timeout);
    // Tout code < 500 = serveur joignable = on est online
    lastPingResult = res.status < 500;
  } catch {
    lastPingResult = false;
  }
  lastPingAt = now;
  return lastPingResult;
}

// ============================================================
// API publique : opérations qui passent par la queue
// ============================================================

export async function queuedCreateIdea(input: {
  content: string;
  transcriptionSource: "text" | "audio";
  audio?: { blob: Blob; mimeType: string; durationMs: number };
}): Promise<LocalIdea> {
  const supabase = createClient();

  // On TENTE toujours d'abord (navigator.onLine ment sur Safari PWA).
  // Seule une vraie erreur réseau nous fait basculer en queue.
  {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Auth introuvable côté client. Avant de bailout, vérifie réseau
        // réel : si on est vraiment offline, on bascule en queue plutôt
        // que d'erroriser l'utilisatrice.
        const reachable = await isReallyOnline();
        if (!reachable) throw new TypeError("offline");
        throw new Error("Non authentifié");
      }

      const { data, error } = await supabase
        .from("ideas")
        .insert({
          user_id: user.id,
          content: input.content,
          transcription_source: input.transcriptionSource,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      const idea = data as Idea;

      if (input.audio) {
        try {
          await uploadAudioInline(idea.id, input.audio);
        } catch (uploadErr) {
          if (isNetworkError(uploadErr)) {
            // Idée créée mais upload audio fail : on enqueue le retry audio
            const audioRef = newLocalId();
            await putItem<LocalAudio>(STORES.audios, {
              id: audioRef,
              blob: input.audio.blob,
              mimeType: input.audio.mimeType,
              durationMs: input.audio.durationMs,
              createdAt: Date.now(),
            });
            await putItem<PendingOp>(STORES.queue, {
              kind: "upload_audio",
              id: newOpId(),
              createdAt: Date.now(),
              payload: { ideaId: idea.id, audioRef },
            });
            notifyQueueChange();
          } else {
            throw uploadErr;
          }
        }
      }

      return idea;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Sinon, on tombe dans le path offline
    }
  }

  // === Offline path ===
  const localId = newLocalId();
  const now = new Date().toISOString();
  const localIdea: LocalIdea = {
    id: localId,
    user_id: "local",
    title: null,
    hook: null,
    content: input.content,
    caption: null,
    transcription_source: input.transcriptionSource,
    category_id: null,
    status: "draft",
    ai_caption: null,
    ai_hashtags: null,
    created_at: now,
    updated_at: now,
    _pending: true,
  };
  await putItem<LocalIdea>(STORES.ideas, localIdea);

  let audioRef: string | undefined;
  if (input.audio) {
    audioRef = newLocalId();
    await putItem<LocalAudio>(STORES.audios, {
      id: audioRef,
      blob: input.audio.blob,
      mimeType: input.audio.mimeType,
      durationMs: input.audio.durationMs,
      createdAt: Date.now(),
    });
  }

  await putItem<PendingOp>(STORES.queue, {
    kind: "create_idea",
    id: newOpId(),
    createdAt: Date.now(),
    payload: {
      localId,
      content: input.content,
      transcriptionSource: input.transcriptionSource,
      audioRef,
    },
  });

  notifyQueueChange();
  return localIdea;
}

export async function queuedUpdateIdea(
  ideaId: string,
  patch: {
    title?: string | null;
    hook?: string | null;
    content?: string;
    caption?: string | null;
    category_id?: string | null;
    status?: IdeaStatus;
    ai_caption?: string | null;
    ai_hashtags?: string[] | null;
  },
): Promise<void> {
  const supabase = createClient();
  const isLocal = isLocalId(ideaId);

  // Idée déjà en DB : on tente toujours (Safari PWA peut mentir sur navigator.onLine)
  if (!isLocal) {
    try {
      const { error } = await supabase
        .from("ideas")
        .update(patch)
        .eq("id", ideaId);
      if (error) throw error;
      return;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }

  // Offline ou idée non encore syncée : enqueue + maj locale optimiste
  const local = await getItem<LocalIdea>(STORES.ideas, ideaId);
  if (local) {
    const merged: LocalIdea = {
      ...local,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.hook !== undefined ? { hook: patch.hook } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
      ...(patch.category_id !== undefined
        ? { category_id: patch.category_id }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.ai_caption !== undefined
        ? { ai_caption: patch.ai_caption }
        : {}),
      ...(patch.ai_hashtags !== undefined
        ? { ai_hashtags: patch.ai_hashtags }
        : {}),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    await putItem<LocalIdea>(STORES.ideas, merged);
  }

  await putItem<PendingOp>(STORES.queue, {
    kind: "update_idea",
    id: newOpId(),
    createdAt: Date.now(),
    payload: { ideaId, patch },
  });
  notifyQueueChange();
}

export async function queuedDeleteIdea(ideaId: string): Promise<void> {
  const isLocal = isLocalId(ideaId);

  // Idée encore locale (jamais syncée) : annule en supprimant queue+store
  if (isLocal) {
    await deleteItem(STORES.ideas, ideaId);
    const allOps = await getAll<PendingOp>(STORES.queue);
    for (const op of allOps) {
      if (
        (op.kind === "create_idea" && op.payload.localId === ideaId) ||
        (op.kind === "update_idea" && op.payload.ideaId === ideaId) ||
        (op.kind === "upload_audio" && op.payload.ideaId === ideaId)
      ) {
        await deleteItem(STORES.queue, op.id);
      }
    }
    notifyQueueChange();
    return;
  }

  // Idée déjà en DB : on tente toujours
  {
    try {
      const { deleteIdea } = await import("@/lib/ideas");
      await deleteIdea(ideaId);
      return;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }

  await putItem<PendingOp>(STORES.queue, {
    kind: "delete_idea",
    id: newOpId(),
    createdAt: Date.now(),
    payload: { ideaId },
  });
  notifyQueueChange();
}

// ============================================================
// Listing local
// ============================================================

export async function getLocalPendingIdeas(): Promise<LocalIdea[]> {
  const all = await getAll<LocalIdea>(STORES.ideas);
  return all.filter((i) => i._pending);
}

// ============================================================
// Sync engine
// ============================================================

let isSyncing = false;
const queueListeners = new Set<() => void>();

/** Événements de sync émis quand une idée pending devient syncée. */
export type SyncedIdeaEvent = {
  /** id Supabase de l'idée maintenant en DB */
  realId: string;
  /** id local d'origine (si l'idée a été créée offline) */
  localId?: string;
  at: number;
};
const syncedListeners = new Set<(e: SyncedIdeaEvent) => void>();

export function subscribeQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

export function subscribeSynced(
  listener: (e: SyncedIdeaEvent) => void,
): () => void {
  syncedListeners.add(listener);
  return () => {
    syncedListeners.delete(listener);
  };
}

function notifySynced(e: SyncedIdeaEvent) {
  syncedListeners.forEach((l) => {
    try {
      l(e);
    } catch {
      // ignore
    }
  });
}

function notifyQueueChange() {
  queueListeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

export async function getPendingCount(): Promise<number> {
  try {
    return await countStore(STORES.queue);
  } catch {
    return 0;
  }
}

export async function syncQueue(): Promise<{
  done: number;
  failed: number;
}> {
  if (isSyncing) return { done: 0, failed: 0 };
  // Note : on ne check PLUS navigator.onLine ici (ment sur Safari PWA).
  // On tente, et runOp détectera les erreurs réseau pour s'arrêter proprement.

  isSyncing = true;
  let done = 0;
  let failed = 0;
  try {
    const ops = (await getAll<PendingOp>(STORES.queue)).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const idMap = new Map<string, string>();

    for (const op of ops) {
      try {
        await runOp(op, idMap);
        await deleteItem(STORES.queue, op.id);
        done++;
      } catch (e) {
        if (isNetworkError(e)) {
          break; // on retentera plus tard
        }
        // Erreur permanente : on skip pour ne pas bloquer
        await deleteItem(STORES.queue, op.id);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
    notifyQueueChange();
  }
  return { done, failed };
}

async function runOp(
  op: PendingOp,
  idMap: Map<string, string>,
): Promise<void> {
  const supabase = createClient();

  if (op.kind === "create_idea") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data, error } = await supabase
      .from("ideas")
      .insert({
        user_id: user.id,
        content: op.payload.content,
        transcription_source: op.payload.transcriptionSource,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;
    const realIdea = data as Idea;
    idMap.set(op.payload.localId, realIdea.id);
    notifySynced({
      realId: realIdea.id,
      localId: op.payload.localId,
      at: Date.now(),
    });

    if (op.payload.audioRef) {
      const audio = await getItem<LocalAudio>(
        STORES.audios,
        op.payload.audioRef,
      );
      if (audio) {
        try {
          await uploadAudioInline(realIdea.id, {
            blob: audio.blob,
            mimeType: audio.mimeType,
            durationMs: audio.durationMs,
          });
          await deleteItem(STORES.audios, op.payload.audioRef);
        } catch (e) {
          if (isNetworkError(e)) throw e;
          // Erreur permanente sur l'audio : on cleanup l'audio et on continue
          await deleteItem(STORES.audios, op.payload.audioRef);
        }
      }
    }

    await deleteItem(STORES.ideas, op.payload.localId);
    return;
  }

  if (op.kind === "update_idea") {
    const realId = isLocalId(op.payload.ideaId)
      ? idMap.get(op.payload.ideaId)
      : op.payload.ideaId;
    if (!realId) {
      // Idée locale non encore créée (le create a été supprimé / fail) : skip
      return;
    }
    const { error } = await supabase
      .from("ideas")
      .update(op.payload.patch)
      .eq("id", realId);
    if (error) throw error;
    if (isLocalId(op.payload.ideaId)) {
      await deleteItem(STORES.ideas, op.payload.ideaId);
    }
    return;
  }

  if (op.kind === "delete_idea") {
    const realId = isLocalId(op.payload.ideaId)
      ? idMap.get(op.payload.ideaId)
      : op.payload.ideaId;
    if (!realId) return;
    const { deleteIdea } = await import("@/lib/ideas");
    await deleteIdea(realId);
    return;
  }

  if (op.kind === "upload_audio") {
    const realId = isLocalId(op.payload.ideaId)
      ? idMap.get(op.payload.ideaId)
      : op.payload.ideaId;
    if (!realId) return;
    const audio = await getItem<LocalAudio>(STORES.audios, op.payload.audioRef);
    if (!audio) return;
    await uploadAudioInline(realId, {
      blob: audio.blob,
      mimeType: audio.mimeType,
      durationMs: audio.durationMs,
    });
    await deleteItem(STORES.audios, op.payload.audioRef);
    return;
  }
}

async function uploadAudioInline(
  ideaId: string,
  audio: { blob: Blob; mimeType: string; durationMs: number },
): Promise<void> {
  const { uploadAudioForIdea } = await import("@/lib/ideas");
  await uploadAudioForIdea(ideaId, audio);
}

// ============================================================
// Boot : detect online + auto-sync
// ============================================================

let booted = false;

export function bootOfflineSync() {
  if (booted) return;
  booted = true;
  if (typeof window === "undefined") return;

  const trigger = () => {
    void syncQueue();
  };

  // Tente une sync au boot même si navigator.onLine ment (Safari PWA)
  setTimeout(trigger, 1500);

  // Réagit aux events natifs (peu fiable mais on les écoute quand même)
  window.addEventListener("online", trigger);

  // Ping réel toutes les 15s : si Supabase répond, on tente la sync
  setInterval(async () => {
    const ok = await isReallyOnline();
    if (ok) trigger();
  }, 15_000);

  // Bonus : retente la sync chaque fois que l'app revient au premier plan
  // (utile pour les PWA iOS qui se mettent en veille)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void isReallyOnline().then((ok) => {
        if (ok) trigger();
      });
    }
  });
}
