import Link from "next/link";

type SearchParams = Promise<{ reason?: string }>;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason } = await searchParams;

  const message =
    reason === "not_allowed"
      ? "Cette adresse email n'est pas autorisée à accéder à Insta Vault."
      : reason === "missing_code"
        ? "Code d'authentification manquant."
        : reason
          ? `Erreur d'authentification : ${reason}`
          : "Une erreur est survenue pendant l'authentification.";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>
        🔒
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        Accès refusé
      </h1>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        {message}
      </p>
      <Link
        href="/login"
        className="text-sm font-medium underline underline-offset-4"
      >
        Retour à la connexion
      </Link>
    </main>
  );
}
