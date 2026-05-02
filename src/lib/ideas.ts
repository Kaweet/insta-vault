"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  AudioBlobResult,
} from "@/lib/useAudioRecorder";
import type { Idea } from "@/lib/types";

export type SaveIdeaInput = {
  /** Si présent, on update cette idée. Sinon on en crée une nouvelle. */
  id?: string;
  content: string;
  transcriptionSource: "text" | "audio";
};

export type SaveIdeaResult = { idea: Idea };

/** Insert ou update une idée. Retourne l'idée enregistrée. */
export async function saveIdea(input: SaveIdeaInput): Promise<SaveIdeaResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  if (input.id) {
    const { data, error } = await supabase
      .from("ideas")
      .update({
        content: input.content,
        transcription_source: input.transcriptionSource,
      })
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return { idea: data as Idea };
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
  return { idea: data as Idea };
}

/** Upload un blob audio dans le bucket et crée la ligne media liée à l'idée. */
export async function uploadAudioForIdea(
  ideaId: string,
  audio: AudioBlobResult,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // Choix de l'extension selon le mime type
  const ext = audio.mimeType.includes("webm")
    ? "webm"
    : audio.mimeType.includes("mp4")
      ? "m4a"
      : audio.mimeType.includes("ogg")
        ? "ogg"
        : "bin";

  const path = `${user.id}/${ideaId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("insta-vault-audio")
    .upload(path, audio.blob, {
      contentType: audio.mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: mediaError } = await supabase.from("media").insert({
    idea_id: ideaId,
    user_id: user.id,
    kind: "audio",
    storage_path: path,
    mime_type: audio.mimeType,
    duration_ms: audio.durationMs,
  });
  if (mediaError) throw mediaError;
}

/** Compte les idées du carnet (pour le shortcut "voir mes idées"). */
export async function countIdeas(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("ideas")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Met à jour le contenu d'une idée. */
export async function updateIdeaContent(
  ideaId: string,
  content: string,
): Promise<Idea> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ideas")
    .update({ content })
    .eq("id", ideaId)
    .select()
    .single();
  if (error) throw error;
  return data as Idea;
}

/** Met à jour des champs arbitraires d'une idée. */
export async function updateIdea(
  ideaId: string,
  patch: {
    title?: string | null;
    hook?: string | null;
    content?: string;
    caption?: string | null;
    category_id?: string | null;
    status?: "draft" | "preparing" | "published";
  },
): Promise<Idea> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ideas")
    .update(patch)
    .eq("id", ideaId)
    .select()
    .single();
  if (error) throw error;
  return data as Idea;
}

/** Charge une idée par id. */
export async function getIdea(ideaId: string): Promise<Idea | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("*")
    .eq("id", ideaId)
    .maybeSingle();
  if (error) throw error;
  return (data as Idea | null) ?? null;
}

/**
 * Supprime une idée et tous ses fichiers audio dans le Storage.
 * La RLS supprime en cascade les lignes media via FK.
 */
export async function deleteIdea(ideaId: string): Promise<void> {
  const supabase = createClient();

  // Récupérer les paths audio liés à cette idée pour les supprimer du Storage
  const { data: mediaRows, error: mediaErr } = await supabase
    .from("media")
    .select("storage_path")
    .eq("idea_id", ideaId)
    .eq("kind", "audio");
  if (mediaErr) throw mediaErr;

  const paths = (mediaRows ?? [])
    .map((m: { storage_path: string | null }) => m.storage_path)
    .filter((p): p is string => p !== null);

  if (paths.length > 0) {
    // remove() ignore les fichiers manquants, donc safe
    const { error: storageErr } = await supabase.storage
      .from("insta-vault-audio")
      .remove(paths);
    if (storageErr) throw storageErr;
  }

  // La FK ON DELETE CASCADE supprime aussi les lignes media
  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) throw error;
}
