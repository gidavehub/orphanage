import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { formatStaffDateTime, relativeTime } from "@/lib/admin/format";
import type { OutboxStatus } from "@/lib/model/domain/system";
import { listEmailLog } from "@/lib/server/dal/settings";
import { cn } from "@/lib/cn";

// Settings › Email log (admin-ux §6.16; integrations §4): every email Haven queued, its state, and a
// preview. In practice mode emails are held here instead of being sent ("Open Outbox" on the ribbon).

export const metadata: Metadata = { title: "Email log" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

const STATUS: Record<OutboxStatus, { label: string; cls: string }> = {
  queued: { label: "Waiting to send", cls: "bg-sand text-body" },
  sending: { label: "Sending", cls: "bg-sand text-body" },
  scheduled: { label: "Scheduled", cls: "bg-cream text-ink" },
  held: { label: "Held (practice)", cls: "bg-marigold-100 text-umber" },
  sent: { label: "Sent", cls: "bg-mint text-deep" },
  failed: { label: "Couldn’t send", cls: "bg-danger/10 text-danger" },
  cancelled: { label: "Cancelled", cls: "bg-sand text-body" },
  suppressed: { label: "Not sent (unsubscribed)", cls: "bg-sand text-body" },
};
const FILTERS: Array<[OutboxStatus | null, string]> = [
  [null, "All"],
  ["held", "Held"],
  ["sent", "Sent"],
  ["scheduled", "Scheduled"],
  ["failed", "Couldn’t send"],
];

export default function EmailLogPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Email log" description="Every email Haven sends, and whether it went." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Log({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = one(sp.status);
  const log = await listEmailLog({ status, cursor: one(sp.cursor) });
  const q = (s: string | null, cursor?: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (cursor) p.set("cursor", cursor);
    const str = p.toString();
    return str ? `/admin/settings/email-log?${str}` : "/admin/settings/email-log";
  };
  return (
    <div className="grid gap-5">
      {log.mode === "mailbox" ? (
        <Notice tone="info" compact title="Practice mode: nothing leaves this computer">
          {log.full ? "Emails wait here so you can read exactly what people would get. Connect email in Settings › Connections to send them." : "Here are the emails Haven would have sent you. Open one to read it."}
        </Notice>
      ) : null}
      <nav aria-label="Filter emails">
        <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map(([s, label]) => (
            <li key={label}>
              <Link
                href={q(s)}
                aria-current={status === s || (!status && !s) ? "page" : undefined}
                className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-bold", status === s || (!status && !s) ? "bg-forest text-white" : "bg-white text-ink shadow-chip hover:bg-mint")}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {log.rows.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">No emails here.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-soft">
          {log.rows.map((r) => {
            const st = STATUS[r.status];
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[15.5px] font-extrabold text-ink">{r.subject}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", st.cls)}>{st.label}</span>
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-body">
                    {r.what} · to {r.to} · <span title={formatStaffDateTime(r.createdAt, log.tz)}>{relativeTime(r.createdAt, log.now)}</span>
                    {r.status === "scheduled" ? ` · goes ${formatStaffDateTime(r.scheduledFor, log.tz)}` : ""}
                    {r.reference ? <span className="font-grotesk tabular-nums"> · {r.reference}</span> : null}
                  </p>
                  {r.lastError && r.status !== "held" ? <p className="mt-1 text-[13px] font-semibold text-danger">{r.lastError}</p> : null}
                </div>
                {r.hasPreview ? <ChevronRight aria-hidden className="size-5 shrink-0 text-body" /> : null}
              </>
            );
            return (
              <li key={r.id} data-template={r.template}>
                {r.hasPreview ? (
                  <Link href={`/admin/settings/email-log/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream/60">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {log.nextCursor ? (
        <Link href={q(status, log.nextCursor)} className="mx-auto inline-flex h-11 items-center rounded-full bg-white px-5 text-[14.5px] font-bold text-ink shadow-chip hover:bg-mint">
          Show older
        </Link>
      ) : null}
    </div>
  );
}
