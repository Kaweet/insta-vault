import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Idea } from "@/lib/types";

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

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

      <ul className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Aucune idée pour le moment.
          </li>
        ) : (
          list.map((idea) => (
            <li
              key={idea.id}
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-neutral-900 dark:text-neutral-100">
                {idea.content || "(audio sans transcription)"}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
                <span>
                  {new Date(idea.created_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="capitalize">
                  {idea.transcription_source === "audio" ? "🎤" : "✍️"}{" "}
                  {idea.status}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
