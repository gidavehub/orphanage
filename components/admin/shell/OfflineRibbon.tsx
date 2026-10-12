"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/admin/net";

/**
 * The offline ribbon (admin-ux §3.7, PLAN D12): shown while the connection is down. What you're
 * typing stays on the page; saving works again as soon as the connection is back.
 */
export function OfflineRibbon() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2.5 bg-umber px-4 py-2 text-[14px] font-semibold text-white sm:px-6">
      <WifiOff aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
      <span>You&rsquo;re offline. What you&rsquo;re typing is safe on this page; saving works again when the connection is back.</span>
    </div>
  );
}
