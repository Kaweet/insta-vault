import Link from "next/link";
import { notFound } from "next/navigation";
import { IdeaEditor } from "@/components/IdeaEditor";
import { createClient } from "@/lib/supabase/server";
import type { Category, Idea, Media } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [ideaRes, categoriesRes, mediaRes] = await Promise.all([
    supabase.from("ideas").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase
      .from("media")
      .select("*")
      .eq("idea_id", id)
      .eq("kind", "audio")
      .order("created_at", { ascending: false }),
  ]);

  if (!ideaRes.data) notFound();

  const idea = ideaRes.data as Idea;
  const categories = (categoriesRes.data ?? []) as Category[];
  const audioMedia = (mediaRes.data ?? []) as Media[];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/ideas"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50"
        >
          ← Idées
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Édition</h1>
        <span className="w-12 text-right text-xs text-neutral-400">
          {idea.transcription_source === "audio" ? "🎤" : "✍️"}
        </span>
      </header>

      <IdeaEditor
        initialIdea={idea}
        categories={categories}
        audioMedia={audioMedia}
      />
    </main>
  );
}
