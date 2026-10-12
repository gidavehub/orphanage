import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder rows for split-view lists while their data streams in. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="grid gap-3">
      <Skeleton className="h-11 w-64 rounded-full" />
      <div className="overflow-hidden rounded-[22px] bg-white shadow-soft">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
            <Skeleton className="size-2 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a record panel while it streams in. */
export function RecordSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-5">
      <div className="rounded-[26px] bg-white p-6 shadow-soft">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-6 h-16 w-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-[22px]" />
        <Skeleton className="h-64 w-full rounded-[22px]" />
      </div>
    </div>
  );
}
