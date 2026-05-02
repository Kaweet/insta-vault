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
