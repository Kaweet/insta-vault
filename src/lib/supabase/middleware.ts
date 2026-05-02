import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error"];

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "insta_vault" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          if (headers) {
            Object.entries(headers).forEach(([k, v]) =>
              response.headers.set(k, v),
            );
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() valide le token côté serveur (contrairement à getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isApi = pathname.startsWith("/api/");

  // Pour /api/*, on ne redirige jamais : les routes gèrent leur propre 401/403
  // (avec requireAllowedUser). On laisse juste passer la session refresh.
  if (isApi) {
    return response;
  }

  // Pas connecté + page protégée → redirect vers /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Connecté avec email non whitelisté → kick out
  if (user) {
    const allowed = getAllowedEmails();
    const email = user.email?.toLowerCase();
    if (!email || !allowed.includes(email)) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/error";
      url.searchParams.set("reason", "not_allowed");
      return NextResponse.redirect(url);
    }
  }

  // Connecté + sur /login → redirect vers home
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
