import { cn } from "@/lib/cn";

export type SkeletonProps = {
  /** Size and radius come from the caller so the block matches what it stands in for. */
  className?: string;
  shape?: "text" | "block" | "circle";
};

/** A warm stone placeholder with a cream sweep; static under reduced motion (globals.css `skeleton`). */
export function Skeleton({ className, shape = "block" }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "skeleton block",
        shape === "text" && "h-[0.9em] w-full rounded-full",
        shape === "block" && "rounded-tile",
        shape === "circle" && "aspect-square rounded-full",
        className,
      )}
    />
  );
}

/** Announces a loading region once; put skeletons inside it (loading.tsx files). */
export function LoadingRegion({ label = "Loading…", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Stands in for a 56px list row (admin lists, DataList). */
export function SkeletonRow({ avatar = true, className }: { avatar?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-14 items-center gap-4 border-b border-line px-4", className)}>
      {avatar ? <Skeleton shape="circle" className="size-8" /> : null}
      <div className="grid flex-1 gap-2">
        <Skeleton shape="text" className="h-3.5 w-2/5" />
        <Skeleton shape="text" className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-7 w-24 rounded-full" />
    </div>
  );
}
