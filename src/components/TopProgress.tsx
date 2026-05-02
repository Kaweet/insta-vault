"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Wrapper qui re-mount le composant interne à chaque changement de pathname,
 * ce qui reset son état visible=false naturellement.
 */
export function TopProgress() {
  const pathname = usePathname();
  return <TopProgressInner key={pathname} pathname={pathname} />;
}

function TopProgressInner({ pathname }: { pathname: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (href === pathname) return;
      if (anchor.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      setVisible(true);
      // Filet de sécurité : 5s max
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => setVisible(false), 5000);
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent"
    >
      <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-neutral-900 dark:bg-neutral-50" />
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
