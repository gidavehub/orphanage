"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PublishSheet, type PublishActions } from "./PublishSheet";

/** The "Review & put live" entry on the Changes page (the same sheet the studio opens). */
export function ChangesPanel({ count, actions, canPublish }: { count: number; actions: PublishActions; canPublish: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-5 shadow-soft">
      <p className="text-[16px] text-ink">
        {count ? (
          <>
            <span className="font-extrabold">{count}</span> change{count === 1 ? "" : "s"} not live yet.
          </>
        ) : (
          "Everything on the website is live."
        )}
      </p>
      <Button type="button" variant={count ? "forest" : "outline"} size="sm" icon="none" onClick={() => setOpen(true)}>
        Review &amp; put live
      </Button>
      <PublishSheet open={open} onClose={() => setOpen(false)} actions={actions} canPublish={canPublish} onDone={() => router.refresh()} />
    </div>
  );
}
