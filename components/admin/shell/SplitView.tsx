"use client";

import { Suspense } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/cn";

export type SplitViewProps = {
  /** The list pane (a client list fed by the layout's Suspense child, PLAN D3). */
  list: React.ReactNode;
  /** The detail route (`[ref]/page.tsx`), or the empty "Pick something" page. */
  children: React.ReactNode;
  /** Accessible names for the two panes. */
  listLabel?: string;
  detailLabel?: string;
  className?: string;
};

function Frame({ open, list, children, listLabel, detailLabel, className }: SplitViewProps & { open: boolean }) {
  return (
    <div data-detail={open ? "open" : "closed"} className={cn("lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6", className)}>
      <section
        aria-label={listLabel}
        className={cn("min-w-0 lg:sticky lg:top-[96px] lg:block lg:max-h-[calc(100dvh-120px)] lg:overflow-y-auto lg:overscroll-contain", open && "hidden")}
      >
        {list}
      </section>
      <section aria-label={detailLabel} className={cn("min-w-0", !open && "hidden lg:block")}>
        {children}
      </section>
    </div>
  );
}

function WithSegment(props: SplitViewProps) {
  // A record is open when the layout has a child segment (`/inbox/HVN-…` rather than `/inbox`).
  const segment = useSelectedLayoutSegment();
  return <Frame {...props} open={segment !== null && segment !== "__PAGE__"} />;
}

/**
 * The split-view pattern (admin-ux §3.8; PLAN D3–D4): from 1024px the list (380px, scrolling on its
 * own) sits beside the open record; on phones the list is the page and opening a row pushes the
 * record full screen (a real route, so the back gesture works). The segment hook lives in a
 * Suspense-wrapped inner leaf; its fallback assumes the list is showing.
 */
export function SplitView(props: SplitViewProps) {
  return (
    <Suspense fallback={<Frame {...props} open={false} />}>
      <WithSegment {...props} />
    </Suspense>
  );
}
