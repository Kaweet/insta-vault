import Link from "next/link";
import { IdeasList } from "@/components/IdeasList";
import { createClient } from "@/lib/supabase/server";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (ideas ?? []) as Idea[];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50"
        >
          ← Retour
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Mes idées</h1>
        <span className="text-xs text-neutral-400">{list.length}</span>
      </header>

      <IdeasList initialIdeas={list} />
    </main>
  );
}
