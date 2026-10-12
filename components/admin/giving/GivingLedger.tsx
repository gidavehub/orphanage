"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Gift, HandHeart } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { StatusPill } from "@/components/ui/StatusPill";
import { Chips } from "@/components/ui/form/Chips";
import { formatMoney } from "@/lib/money";
import type { LedgerDTO } from "@/lib/server/dal/donations";
import { cn } from "@/lib/cn";

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Banjul" });

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The gift ledger (admin-ux §6.6): this month's totals per currency (never added together), the
 * thank-yous to send and the gifts not yet placed, filters, and gifts grouped by day with the next
 * step on each row.
 */
export function GivingLedger({ ledger }: { ledger: LedgerDTO }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get("kind") ?? "all";
  const stage = params.get("stage") ?? "all";
  const set = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (!v || v === "all") sp.delete(k);
    else sp.set(k, v);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };
  const rows = ledger.rows.filter(
    (r) =>
      (kind === "all" || (kind === "cash" ? r.kind === "cash" : kind === "kind" ? r.kind === "in_kind" : kind === "online" ? r.online : !r.online)) &&
      (stage === "all" || r.status === stage),
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const day = dayFmt.format(r.createdAt);
    groups.set(day, [...(groups.get(day) ?? []), r]);
  }
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(Number(ledger.month.slice(0, 4)), Number(ledger.month.slice(5)) - 1, 1));

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-[22px] bg-white p-5 shadow-soft md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-body">{monthLabel}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-display text-[28px] leading-tight text-ink md:text-[32px]">
            {ledger.totals.length ? ledger.totals.map((t) => <span key={t.currency}>{formatMoney({ amountMinor: t.amountMinor, currency: t.currency })}</span>) : <span>Nothing received yet</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => set("stage", "received")} className="h-11 rounded-full bg-marigold-100 px-4 text-[14px] font-bold text-umber">
            {ledger.toThank} thank-you{ledger.toThank === 1 ? "" : "s"} to send
          </button>
          <button type="button" onClick={() => set("stage", "acknowledged")} className="h-11 rounded-full bg-mint px-4 text-[14px] font-bold text-deep">
            {ledger.notPlaced} not yet put towards
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Chips
          label="Kind"
          tone="clay"
          size="sm"
          scroll
          value={kind}
          onChange={(v) => set("kind", v)}
          options={[
            { value: "all", label: "All" },
            { value: "cash", label: "Money" },
            { value: "kind", label: "In kind" },
            { value: "online", label: "Online" },
            { value: "offline", label: "Recorded by us" },
          ]}
        />
        <Chips
          label="Stage"
          tone="forest"
          size="sm"
          scroll
          value={stage}
          onChange={(v) => set("stage", v)}
          options={[
            { value: "all", label: "Any stage" },
            { value: "pledged", label: "Pledged" },
            { value: "pending", label: "Pending" },
            { value: "received", label: "Received" },
            { value: "acknowledged", label: "Thanked" },
            { value: "allocated", label: "Placed" },
          ]}
        />
        <span className="ml-auto flex gap-2">
          <Link href={`${pathname}?month=${shiftMonth(ledger.month, -1)}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink hover:border-forest">
            ‹ Earlier
          </Link>
          <Link href={`${pathname}?month=${shiftMonth(ledger.month, 1)}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink hover:border-forest">
            Later ›
          </Link>
        </span>
      </div>

      {groups.size ? (
        [...groups.entries()].map(([day, list]) => (
          <section key={day} aria-label={day}>
            <h2 className="mb-2 px-1 font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-body">{day}</h2>
            <ul className="overflow-hidden rounded-[22px] bg-white shadow-soft">
              {list.map((r) => (
                <li key={r.ref}>
                  <Link href={`/admin/giving/${encodeURIComponent(r.ref)}`} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 hover:bg-cream-2 md:flex-nowrap">
                    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full", r.kind === "cash" ? "bg-coral/10 text-coral-800" : "bg-clay/10 text-clay")}>
                      {r.kind === "cash" ? <HandHeart className="size-[18px]" /> : <Gift className="size-[18px]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-grotesk text-[12.5px] font-semibold tabular-nums text-umber">{r.ref.replace(/^HVN-DN-\d{4}-/, "DN-")}</span>
                        <span className="truncate text-[15px] font-bold text-ink">{r.who}</span>
                        {hasFlag(r.country) ? <FlagDisc code={r.country} className="size-4" /> : null}
                      </span>
                      <span className="block truncate font-grotesk text-[13px] text-body">
                        {r.frequency} · {r.target}
                        {r.online ? " · online" : ""}
                      </span>
                    </span>
                    <span className="font-grotesk text-[16px] font-semibold tabular-nums text-ink">{r.amount}</span>
                    <StatusPill workflow={r.kind === "in_kind" ? "inkind" : "donation"} status={r.status} size="sm" />
                    {r.next ? <span className="hidden rounded-full bg-forest px-3.5 py-2 text-[13px] font-bold text-white lg:inline">{r.next}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState compact art="hearts" title="No gifts here yet." body="Gifts recorded by the team and gifts made online appear here." className="rounded-[22px] bg-white" />
      )}
    </div>
  );
}
