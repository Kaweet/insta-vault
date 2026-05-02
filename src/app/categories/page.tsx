import { CategoriesManager } from "@/components/CategoriesManager";
import { OfflineBanner } from "@/components/OfflineBanner";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  const categories = (data ?? []) as Category[];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto w-full max-w-2xl">
        <h1 className="text-lg font-semibold tracking-tight">
          Catégories
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Organise tes idées par thème.
        </p>
      </header>

      <OfflineBanner />
      <CategoriesManager initialCategories={categories} />
    </main>
  );
}
