"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { StatusPill, UrgencyPill } from "@/components/ui/StatusPill";
import { Chips } from "@/components/ui/form/Chips";
import { Segmented } from "@/components/ui/form/Segmented";
import { relativeTime } from "@/lib/admin/format";
import type { RequestRow, RequestsStage } from "@/lib/server/dal/support";
import { STATUS_LABEL } from "@/lib/model/labels";
import { cn } from "@/lib/cn";

const STAGES: RequestsStage[] = ["open", "new", "under_review", "more_info_required", "assigned", "referred", "approved", "support_in_progress", "completed"];

/** The Requests list (admin-ux §6.4 list): stage chips with counts, Mine / Everyone, rows with stage. */
export function RequestsList({ all, mine, counts, now }: { all: RequestRow[]; mine: RequestRow[]; counts: Partial<Record<RequestsStage, number>>; now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const who = params.get("who") === "mine" ? "mine" : "everyone";
  const stageParam = params.get("stage") as RequestsStage | null;
  const stage: RequestsStage = stageParam && STAGES.includes(stageParam) ? stageParam : "open";
  const source = who === "mine" ? mine : all;
  const rows = source.filter((r) => (stage === "open" ? r.stage !== "completed" && r.stage !== "closed" && r.stage !== "declined" : r.stage === stage));
  const openRef = pathname.split("/")[3] ? decodeURIComponent(pathname.split("/")[3]!) : null;
  const go = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (!v) sp.delete(k);
    else sp.set(k, v);
    router.replace(`/admin/requests${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };
  const qs = params.toString();
  return (
    <div className="grid gap-3">
      <Segmented label="Whose" options={[{ value: "everyone", label: "Everyone" }, { value: "mine", label: "Mine" }]} value={who} onChange={(v) => go("who", v === "everyone" ? null : v)} />
      <Chips
        label="Stage"
        tone="clay"
        size="sm"
        scroll
        value={stage}
        onChange={(v) => go("stage", v === "open" ? null : v)}
        options={STAGES.map((s) => ({ value: s, label: s === "open" ? "All open" : STATUS_LABEL.support[s], count: counts[s] ?? 0 }))}
      />
      {rows.length ? (
        <ul className="overflow-hidden rounded-[22px] bg-white shadow-soft">
          {rows.map((r) => (
            <li key={r.ref}>
              <Link
                href={`/admin/requests/${encodeURIComponent(r.ref)}${qs ? `?${qs}` : ""}`}
                aria-current={openRef === r.ref ? "true" : undefined}
                className={cn("relative flex min-h-16 items-center gap-3 border-b border-line py-3 pl-4 pr-3", openRef === r.ref ? "bg-mint/60" : "hover:bg-cream-2")}
              >
                <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-forest" />
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", r.unread ? "bg-marigold" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-grotesk text-[12.5px] font-semibold tabular-nums text-umber">{r.ref.replace(/^HVN-SR-\d{4}-/, "SR-")}</span>
                    <span className={cn("truncate text-[15px] text-ink", r.unread ? "font-extrabold" : "font-bold")}>{r.title}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-grotesk text-[12.5px] text-body">
                    {r.country && hasFlag(r.country) ? <FlagDisc code={r.country} className="size-3.5" /> : null}
                    <span className="truncate">
                      {r.who} · {relativeTime(r.lastActivityAt, now)}
                    </span>
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {r.urgency !== "normal" ? <UrgencyPill urgency={r.urgency} size="sm" /> : null}
                  <StatusPill workflow="support" status={r.stage} size="sm" />
                </span>
                {r.assignee ? <Avatar name={r.assignee.name} uid={r.assignee.uid} tone={r.assignee.tone} size={28} /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact art="sprig" title={who === "mine" ? "Nothing here is yours yet." : "No requests at this stage."} className="rounded-[22px] bg-white" />
      )}
    </div>
  );
}
