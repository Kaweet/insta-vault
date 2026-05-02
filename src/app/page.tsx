export default function Home() {
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
      <p className="text-xs uppercase tracking-widest text-neutral-400">
        v0 · setup en cours
      </p>
    </main>
  );
}
