import { SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto w-full max-w-3xl">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-2 h-4 w-24 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
