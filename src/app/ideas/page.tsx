import { IdeasList } from "@/components/IdeasList";
import { createClient } from "@/lib/supabase/server";
import type { Category, Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = await createClient();
  const [ideasRes, categoriesRes] = await Promise.all([
    supabase
      .from("ideas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("categories").select("*").order("name", { ascending: true }),
  ]);

  const ideas = (ideasRes.data ?? []) as Idea[];
  const categories = (categoriesRes.data ?? []) as Category[];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto w-full max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">Mes idées</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {ideas.length} idée{ideas.length > 1 ? "s" : ""} au total
        </p>
      </header>

      <IdeasList initialIdeas={ideas} categories={categories} />
    </main>
  );
}
