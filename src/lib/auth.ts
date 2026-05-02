import { createClient } from "@/lib/supabase/server";

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Vérifie qu'un user est connecté ET que son email est whitelisté.
 * À appeler en début de chaque Route Handler sensible (IA, etc.).
 * Throw si non autorisé.
 */
export async function requireAllowedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const allowed = getAllowedEmails();
  const email = user.email?.toLowerCase();
  if (!email || !allowed.includes(email)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return { user, supabase };
}
