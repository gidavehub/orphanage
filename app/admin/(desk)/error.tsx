"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/admin/copy";

/** A deploy changes Server Action ids, so a tab left open across a deploy gets this error (next16 §6.1). */
function isStaleAction(error: Error): boolean {
  return /failed to find server action|server action .*not found|unrecognized action/i.test(error.message ?? "");
}

// Errors on a desk screen (PLAN D10; admin-ux §12). The shell stays around it. A stale tab after a
// deploy gets "Please refresh, we've updated the site" with a full reload; anything else gets the
// warm server-error copy and `retry` (re-fetch and re-render the segment).
export default function DeskError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const stale = isStaleAction(error);

  useEffect(() => {
    console.error("[haven] desk error", error.digest ?? "");
  }, [error]);

  return (
    <section role="alert" className="mx-auto flex max-w-[640px] flex-col items-center rounded-control bg-white px-6 py-14 text-center shadow-soft">
      <h1 className="text-balance text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
        {stale ? COPY["error.stale"] : COPY["error.server"]}
      </h1>
      <p className="mt-3 max-w-[460px] text-[16px] leading-relaxed text-body">
        {stale
          ? "Haven was updated while this page was open. Refresh to carry on; anything you typed in a draft is kept."
          : "Please try again. If it keeps happening, let a super admin know what you were doing."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {stale ? (
          <Button type="button" variant="forest" size="sm" icon="none" onClick={() => window.location.reload()}>
            <span className="inline-flex items-center gap-2">
              <RotateCcw aria-hidden className="size-4" strokeWidth={2.5} /> {COPY["error.refresh"]}
            </span>
          </Button>
        ) : (
          <Button type="button" variant="forest" size="sm" icon="none" onClick={() => retry()}>
            <span className="inline-flex items-center gap-2">
              <RotateCcw aria-hidden className="size-4" strokeWidth={2.5} /> {COPY["error.tryAgain"]}
            </span>
          </Button>
        )}
        <Button href="/admin" variant="quiet" size="sm" icon="none">
          Back to Today
        </Button>
      </div>
    </section>
  );
}
