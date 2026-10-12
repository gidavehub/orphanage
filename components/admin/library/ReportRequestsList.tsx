"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { FlagDisc } from "@/components/ui/flag";
import { Segmented } from "@/components/ui/form/Segmented";
import type { ReportRequestRow } from "@/lib/server/dal/reportRequests";
import { cn } from "@/lib/cn";

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Banjul" });

/** The report requests list (admin-ux §6.8): open ones first; the chosen request is highlighted. */
export function ReportRequestsList({ open, done }: { open: ReportRequestRow[]; done: ReportRequestRow[] }) {
  const [tab, setTab] = useState<"open" | "done">("open");
  const current = useSelectedLayoutSegment();
  const rows = tab === "open" ? open : done;
  return (
    <div className="grid gap-3">
      <Segmented
        label="Which requests"
        density="admin"
        skin="donat"
        value={tab}
        options={[
          { value: "open", label: `To do (${open.length})` },
          { value: "done", label: "Done" },
        ]}
        onChange={setTab}
      />
      {rows.length === 0 ? (
        <p className="rounded-[22px] bg-white p-5 text-[15px] text-body shadow-soft">{tab === "open" ? "No requests waiting. Nice." : "Nothing here yet."}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.ref}>
              <Link
                href={`/admin/library/requests/${r.ref}`}
                aria-current={current === r.ref ? "page" : undefined}
                className={cn("block rounded-[18px] bg-white p-4 shadow-soft transition-colors hover:bg-sand/50", current === r.ref && "ring-2 ring-forest")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[15px] font-bold text-ink">{r.title}</p>
                  <StatusPill workflow="reportRequest" status={r.status} size="sm" />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-body">
                  <span className="font-grotesk font-semibold">{r.ref.replace(/^HVN-/, "")}</span> · {r.requester}
                  {r.organisation ? ` · ${r.organisation}` : ""} <FlagDisc code={r.country} className="size-4" /> · {day.format(r.createdAt)}
                  {r.unlisted ? <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[12px] font-bold text-umber">Not in the library</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
