import { SkeletonBlock } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-24 pt-8">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="h-5 w-20" />
        <SkeletonBlock className="h-4 w-12" />
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-10 w-1/2" />
      </div>
    </main>
  );
}
