import { IdeaCapture } from "@/components/IdeaCapture";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase
    .from("ideas")
    .select("*", { count: "exact", head: true });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 pb-24 pt-12">
      <header className="flex w-full max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            💡
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Insta Vault</h1>
        </div>
        {user ? (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              {user.email}
            </button>
          </form>
        ) : null}
      </header>

      <IdeaCapture initialCount={count ?? 0} />
    </main>
  );
}
