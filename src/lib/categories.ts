"use client";

import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export const CATEGORY_COLORS = [
  { name: "rose", hex: "#ec4899" },
  { name: "rouge", hex: "#ef4444" },
  { name: "orange", hex: "#f97316" },
  { name: "ambre", hex: "#f59e0b" },
  { name: "vert", hex: "#10b981" },
  { name: "cyan", hex: "#06b6d4" },
  { name: "bleu", hex: "#3b82f6" },
  { name: "violet", hex: "#8b5cf6" },
  { name: "fuchsia", hex: "#d946ef" },
  { name: "gris", hex: "#6b7280" },
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number]["hex"];

export async function listCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<Category> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      color: input.color,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string },
): Promise<Category> {
  const supabase = createClient();
  const update: { name?: string; color?: string } = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.color !== undefined) update.color = patch.color;

  const { data, error } = await supabase
    .from("categories")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
