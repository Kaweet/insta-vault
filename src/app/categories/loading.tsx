import { SkeletonBlock } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto w-full max-w-2xl">
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="mt-2 h-4 w-48" />
      </header>
      <SkeletonBlock className="mx-auto h-32 w-full max-w-2xl" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-12" />
      </div>
    </main>
  );
}
