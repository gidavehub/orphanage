import { HavenMark } from "@/components/art/Logo";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/**
 * What the desk shows while the session and shell stream in (PLAN D3): the bar, the dock and a page
 * of cream skeleton blocks in the shapes of Today's cards. No spinners for page loads (admin-ux §9.2).
 */
export function AdminShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <div aria-hidden className="sticky top-0 z-40 hidden h-[76px] items-center bg-white/90 lg:flex">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-6 px-6">
          <HavenMark className="h-9 w-9" />
          <Skeleton className="h-14 flex-1 rounded-full" />
          <Skeleton shape="circle" className="size-12" />
          <Skeleton className="h-12 w-28 rounded-full" />
          <Skeleton shape="circle" className="size-11" />
        </div>
      </div>
      <div aria-hidden className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-white/95 px-4 lg:hidden">
        <HavenMark className="h-7 w-7" />
        <Skeleton shape="text" className="h-4 w-24" />
        <Skeleton shape="circle" className="ml-auto size-9" />
      </div>
      <LoadingRegion label="Loading Haven…" className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 md:px-6 lg:pt-8">
        <AdminPageSkeleton />
      </LoadingRegion>
      <div aria-hidden className="fixed inset-x-0 bottom-0 z-40 h-16 rounded-t-3xl bg-white shadow-dock lg:hidden" />
    </div>
  );
}

/** A page's worth of placeholder cards (also the desk's loading.tsx). */
export function AdminPageSkeleton() {
  return (
    <div aria-hidden className="grid gap-6">
      <div className="grid gap-3">
        <Skeleton shape="text" className="h-8 w-64 max-w-full" />
        <Skeleton shape="text" className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3 rounded-control bg-white p-5 shadow-soft">
            <Skeleton shape="circle" className="size-11" />
            <Skeleton shape="text" className="h-5 w-3/4" />
            <Skeleton shape="text" className="w-1/2" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-card bg-white shadow-soft">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-14 items-center gap-4 border-b border-line px-4 last:border-0">
            <Skeleton shape="circle" className="size-8" />
            <div className="grid flex-1 gap-2">
              <Skeleton shape="text" className="h-3.5 w-2/5" />
              <Skeleton shape="text" className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
