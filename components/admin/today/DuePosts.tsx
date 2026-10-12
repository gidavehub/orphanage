"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Publishes due scheduled posts once when Today opens (PLAN D110), then refreshes if any went live.
 * Renders nothing. Never runs during render: the action is called from an effect.
 */
export function DuePosts({ action }: { action: () => Promise<{ published: number }> }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    action()
      .then((r) => {
        if (r.published > 0) router.refresh();
      })
      .catch(() => undefined);
  }, [action, router]);
  return null;
}
