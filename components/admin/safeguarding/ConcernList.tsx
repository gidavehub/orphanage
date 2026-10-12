"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { Chips } from "@/components/ui/form/Chips";
import { relativeTime } from "@/lib/admin/format";
import type { ConcernRow } from "@/lib/server/dal/concerns";
import { STATUS_LABEL } from "@/lib/model/labels";
import { cn } from "@/lib/cn";

const RISK: Record<string, { label: string; cls: string }> = {
  immediate: { label: "Immediate", cls: "bg-coral-800 text-white" },
  high: { label: "High", cls: "bg-umber text-white" },
  medium: { label: "Medium", cls: "bg-marigold-100 text-umber" },
  low: { label: "Low", cls: "bg-mint text-deep" },
  no_concern: { label: "No concern", cls: "bg-pebble text-body" },
};

/**
 * The Safeguarding list (admin-ux §6.5): only the reference, risk, stage, age range, country, who
 * looks after it and how old it is. Never narrative, never the reporter.
 */
export function ConcernList({ open, closed, now }: { open: ConcernRow[]; closed: ConcernRow[]; now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "open";
  const openRef = pathname.split("/")[3] ? decodeURIComponent(pathname.split("/")[3]!) : null;
  const rows =
    tab === "closed"
      ? closed
      : tab === "immediate"
        ? open.filter((r) => r.risk === "immediate" || r.risk === "high")
        : tab === "followups"
          ? open.filter((r) => r.followUpAt && r.followUpAt <= now + 86_400_000)
          : open;
  const set = (v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "open") sp.delete("tab");
    else sp.set("tab", v);
    router.replace(`/admin/safeguarding${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };
  return (
    <div className="grid gap-3">
      <Chips
        label="Concerns"
        tone="forest"
        size="sm"
        scroll
        value={tab}
        onChange={set}
        options={[
          { value: "open", label: "Open", count: open.length },
          { value: "immediate", label: "High or immediate", count: open.filter((r) => r.risk === "immediate" || r.risk === "high").length },
          { value: "followups", label: "Follow-ups due", count: open.filter((r) => r.followUpAt && r.followUpAt <= now + 86_400_000).length },
          { value: "closed", label: "Closed", count: closed.length },
        ]}
      />
      {rows.length ? (
        <ul className="overflow-hidden rounded-[18px] bg-white shadow-soft">
          {rows.map((r) => {
            const risk = r.risk ? RISK[r.risk] : null;
            return (
              <li key={r.ref}>
                <Link
                  href={`/admin/safeguarding/${encodeURIComponent(r.ref)}${params.toString() ? `?${params}` : ""}`}
                  aria-current={openRef === r.ref ? "true" : undefined}
                  className={cn("relative flex min-h-16 items-center gap-3 border-b border-line py-3 pl-4 pr-3", openRef === r.ref ? "bg-[#e7eeeb]" : "hover:bg-[#f2f6f4]")}
                >
                  <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-deep" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Lock aria-hidden className="size-3.5 shrink-0 text-deep" strokeWidth={2.75} />
                      <span className="font-grotesk text-[13px] font-semibold tabular-nums text-deep">{r.ref}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", risk ? risk.cls : "bg-pebble text-body")}>{risk ? risk.label : "Risk not set"}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 font-grotesk text-[12.5px] text-body">
                      {r.country && hasFlag(r.country) ? <FlagDisc code={r.country} className="size-3.5" /> : null}
                      <span className="truncate">
                        {r.ageBand ? `Age ${r.ageBand}` : "Age not given"} · {STATUS_LABEL.concern[r.status]} · {relativeTime(r.createdAt, now)}
                        {r.waitingSecondSignOff ? " · waiting for a second sign-off" : ""}
                        {r.suspectedSpam ? " · flagged as possible spam" : ""}
                      </span>
                    </span>
                  </span>
                  {r.assignee ? <Avatar name={r.assignee.name} uid={r.assignee.uid} tone={r.assignee.tone} size={28} /> : <span className="font-grotesk text-[12px] text-body">Not taken</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[18px] bg-white p-6 text-center text-[15px] text-body shadow-soft">Nothing here.</p>
      )}
    </div>
  );
}
