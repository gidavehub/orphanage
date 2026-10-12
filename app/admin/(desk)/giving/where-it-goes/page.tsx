import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { getCauseTotals, getCauses } from "@/lib/content/public";
import type { Currency } from "@/lib/model/enums";
import { formatMoney } from "@/lib/money";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listAllocationSummaries } from "@/lib/server/dal/allocations";
import { givingTabs } from "../tabs";

// Giving › Where it goes (admin-ux §6.6, PLAN D57): for each currency, what has been put towards each
// programme and cause (never added across currencies), and the annual "where the money went"
// summaries finance keeps and verifies for /impact.

export const metadata: Metadata = { title: "Where it goes" };

export default function WhereItGoesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Totals />
    </Suspense>
  );
}

const NEEDED_MOST = "Where it’s needed most";
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const iso = (d: string) => dayFmt.format(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))));

async function Totals() {
  const v = await requireStaff("donation.read", "donation.summary", "donation.manage");
  const [totals, causes, summaries] = await Promise.all([getCauseTotals(), getCauses({ liveOnly: false }), listAllocationSummaries()]);
  const titleOf = (slug: string) => (slug === "general" ? NEEDED_MOST : (causes.find((c) => c.slug === slug)?.title ?? slug));
  const byCurrency = new Map<Currency, Array<{ slug: string; minor: number; gifts: number }>>();
  for (const [slug, t] of Object.entries(totals)) {
    for (const [cur, x] of Object.entries(t ?? {})) {
      if (!x || typeof x !== "object" || !("raisedMinor" in x) || !x.raisedMinor) continue;
      const list = byCurrency.get(cur as Currency) ?? [];
      list.push({ slug, minor: x.raisedMinor, gifts: x.gifts });
      byCurrency.set(cur as Currency, list);
    }
  }
  return (
    <>
      <PageHeader title="Giving" description="What has been put towards each programme and cause, per currency." tabs={givingTabs("where", (p) => has(v, p))} />
      {byCurrency.size === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">Nothing has been put towards a programme or cause yet.</p>
      ) : (
        <div className="grid gap-5">
          {[...byCurrency.entries()].map(([cur, list]) => {
            const max = Math.max(...list.map((l) => l.minor));
            return (
              <section key={cur} className="rounded-[22px] bg-white p-5 shadow-soft">
                <h2 className="mb-4 text-[18px] font-extrabold text-ink">{cur}</h2>
                <ul className="grid gap-3">
                  {list
                    .sort((a, b) => b.minor - a.minor)
                    .map((l) => (
                      <li key={l.slug}>
                        <div className="flex justify-between gap-3 text-[15px]">
                          <span className="font-bold text-ink">{titleOf(l.slug)}</span>
                          <span className="font-grotesk font-semibold tabular-nums">
                            {formatMoney({ amountMinor: l.minor, currency: cur })} <span className="text-body">· {l.gifts} gift{l.gifts === 1 ? "" : "s"}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-pebble">
                          <div className="h-full rounded-full bg-clay" style={{ width: `${Math.max(3, Math.round((l.minor / max) * 100))}%` }} />
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section aria-labelledby="annual" className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="annual" className="text-[20px] font-extrabold text-ink">
              Yearly summaries for the Impact page
            </h2>
            <p className="mt-1 text-[14.5px] text-body">What came in and where it went, for each financial year. Donors see the latest one once finance has checked it.</p>
          </div>
          {summaries.canEdit ? (
            <Button href="/admin/giving/where-it-goes/new" variant="outline" size="sm" icon="plus" iconFirst>
              Add a year
            </Button>
          ) : null}
        </div>
        {summaries.rows.length === 0 ? (
          <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">No yearly summaries yet.</p>
        ) : (
          <ul className="grid gap-3">
            {summaries.rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 shadow-soft">
                <div className="min-w-0">
                  <p className="text-[16px] font-extrabold text-ink">{s.label}</p>
                  <p className="text-[13.5px] text-body">
                    {iso(s.periodStart)} to {iso(s.periodEnd)} · {s.currencies.join(" · ") || "No amounts yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${s.verified ? "bg-mint text-deep" : "bg-marigold-100 text-umber"}`}>{s.verified ? "Checked by finance" : s.placeholder ? "Example figures" : "Not checked yet"}</span>
                  {s.hasDraft ? <span className="rounded-full bg-sand px-2.5 py-1 text-[12px] font-bold text-umber">Changes not live</span> : null}
                  {summaries.canEdit ? (
                    <Link href={`/admin/giving/where-it-goes/${s.id}`} className="inline-flex h-10 items-center rounded-full bg-forest px-3.5 text-[13.5px] font-bold text-white hover:bg-deep">
                      Edit
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
