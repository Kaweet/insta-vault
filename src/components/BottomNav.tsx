"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", label: "Capture", icon: "💡" },
  { href: "/ideas", label: "Idées", icon: "📋" },
  { href: "/categories", label: "Catégories", icon: "🏷️" },
] as const;

const HIDDEN_PATHS = ["/login", "/auth"];

function isActive(currentPath: string, tabHref: string): boolean {
  if (tabHref === "/") return currentPath === "/";
  return currentPath === tabHref || currentPath.startsWith(`${tabHref}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (
    HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Barre de progression visible pendant les transitions de page */}
      {isPending ? (
        <span className="absolute left-0 top-0 h-0.5 w-full overflow-hidden">
          <span className="block h-full w-1/3 animate-pulse bg-neutral-900 dark:bg-neutral-50" />
        </span>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => {
                if (active) return;
                // Feedback visuel immédiat + transition non bloquante
                startTransition(() => {
                  router.push(tab.href);
                });
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition active:scale-95 active:bg-neutral-100 dark:active:bg-neutral-800 ${
                active
                  ? "text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
