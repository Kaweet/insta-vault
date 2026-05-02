"use client";

import { createClient } from "@/lib/supabase/client";
import type { Media } from "@/lib/types";

export async function listAudioForIdea(ideaId: string): Promise<Media[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("idea_id", ideaId)
    .eq("kind", "audio")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Media[];
}

/**
 * Crée une URL signée d'1h pour lire un fichier audio depuis le bucket privé.
 */
export async function getSignedAudioUrl(
  storagePath: string,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("insta-vault-audio")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
