import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="text-6xl" aria-hidden>
        💡
      </span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Insta Vault
      </h1>
      <p className="max-w-md text-base text-neutral-500 dark:text-neutral-400">
        Capture tes idées de posts Instagram à la volée — texte, audio,
        catégories, et IA pour les transformer en captions prêtes à publier.
      </p>

      {user ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Connectée en tant que
          </p>
          <p className="text-base font-medium">{user.email}</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}

      <p className="text-xs uppercase tracking-widest text-neutral-400">
        v0 · setup en cours
      </p>
    </main>
  );
}
