import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { AGE_BAND_LABEL, SPONSOR_PROFILE_STATUS_LABEL, SUPPORT_CATEGORY_LABEL } from "@/lib/model/labels";
import { formatMoney, toMinor } from "@/lib/money";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listSponsorProfilesForStaff } from "@/lib/server/dal/sponsors";
import { givingTabs } from "../tabs";

// Giving › Sponsorship (PLAN D55): anonymous profiles. Programme officers draft them; content
// managers put them live once the safety check passes. Codes only, never names.

export const metadata: Metadata = { title: "Sponsorship" };

export default function SponsorshipPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Profiles />
    </Suspense>
  );
}

const CHIP: Record<string, string> = {
  draft: "bg-sand text-umber",
  published: "bg-mint text-deep",
  fully_funded: "bg-marigold-100 text-umber",
  archived: "bg-pebble text-body",
};

const PER: Record<string, string> = { one_off: "", per_term: " a term", per_month: " a month", per_year: " a year" };

async function Profiles() {
  const v = await requireStaff("sponsor.manage", "sponsor.publish");
  const rows = await listSponsorProfilesForStaff();
  return (
    <>
      <PageHeader
        title="Giving"
        description="Anonymous sponsorship profiles: a code, an age band and the need. Never a name or a town."
        tabs={givingTabs("sponsorship", (p) => has(v, p))}
        actions={
          has(v, "sponsor.manage") ? (
            <Button href="/admin/giving/sponsorship/new" variant="forest" size="sm" icon="plus" iconFirst>
              Add a profile
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">No sponsorship profiles yet.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.code}>
              <Link
                href={`/admin/giving/sponsorship/${r.code}`}
                className="grid gap-2 rounded-[22px] bg-white p-4 shadow-soft transition-colors hover:bg-sand/40 md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-center md:gap-4"
              >
                <div className="flex items-center gap-2 md:block">
                  <p className="font-grotesk text-[15px] font-semibold text-ink">{r.code}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold md:mt-1 md:inline-block ${CHIP[r.status]}`}>{SPONSOR_PROFILE_STATUS_LABEL[r.status]}</span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[15px] text-ink">{r.description || "No description yet"}</p>
                  <p className="mt-1 text-[13px] text-body">
                    {SUPPORT_CATEGORY_LABEL[r.category]} · {AGE_BAND_LABEL[r.ageBand]} · {formatMoney({ amountMinor: toMinor(r.amount, r.currency), currency: r.currency })}
                    {PER[r.period]} · {r.sponsorsCurrent} of {r.sponsorsNeeded} sponsor{r.sponsorsNeeded === 1 ? "" : "s"}
                  </p>
                </div>
                {r.flags > 0 ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1 text-[13px] font-bold text-coral-800">
                    <ShieldAlert aria-hidden className="size-4" /> {r.flags} thing{r.flags === 1 ? "" : "s"} to check
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
