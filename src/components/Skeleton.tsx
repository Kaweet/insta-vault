export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <SkeletonBlock className="mb-2 h-4 w-3/4" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="mt-1.5 h-3 w-5/6" />
      <div className="mt-3 flex justify-between">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-16" />
      </div>
    </div>
  );
}
