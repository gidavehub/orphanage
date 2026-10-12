import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyLink } from "@/components/admin/giving/CopyLink";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMoney, toMinor } from "@/lib/money";
import { canCreateItem } from "@/lib/content/access";
import { notFound } from "next/navigation";
import { AREA_PERMS } from "@/lib/admin/access";
import { has, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listCausesForStaff } from "@/lib/server/dal/causes";
import { givingTabs } from "../tabs";

// Giving › Causes (admin-ux §6.6): every cause with what's been raised against its goal (in the
// cause's currency; other currencies shown separately), its derived state (D39) and a link to share.

export const metadata: Metadata = { title: "Causes" };

export default function CausesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Causes />
    </Suspense>
  );
}

const CHIP: Record<string, string> = {
  Live: "bg-mint text-deep",
  Upcoming: "bg-marigold-100 text-umber",
  Paused: "bg-pebble text-body",
  Ended: "bg-pebble text-body",
  Hidden: "bg-pebble text-body",
  "Not live yet": "bg-sand text-umber",
};

async function Causes() {
  const v = await requireStaff(...AREA_PERMS.giving.read);
  if (!hasAny(v, "donation.read", "donation.summary", "donation.manage", "content.edit")) notFound();
  const causes = await listCausesForStaff();
  const editable = canCreateItem(v.roles, "causes");
  return (
    <>
      <PageHeader
        title="Giving"
        description="Causes donors can give to, and how each is doing."
        tabs={givingTabs("causes", (p) => has(v, p))}
        actions={
          editable ? (
            <Button href="/admin/giving/causes/new" variant="forest" size="sm" icon="plus">
              Add a cause
            </Button>
          ) : undefined
        }
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {causes.map((c) => (
          <li key={c.id} className="flex flex-col rounded-[22px] bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.08em] text-body">{c.season || c.kind}</p>
                <h2 className="mt-1 text-[17px] font-extrabold leading-snug text-ink">
                  {editable ? (
                    <Link href={`/admin/giving/causes/${c.id}`} className="hover:text-forest hover:underline">
                      {c.title}
                    </Link>
                  ) : (
                    c.title
                  )}
                </h2>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${CHIP[c.state] ?? "bg-pebble text-body"}`}>{c.state}</span>
            </div>
            <p className="mt-3 font-grotesk text-[15px] font-semibold tabular-nums text-ink">
              {formatMoney({ amountMinor: toMinor(c.raised, c.currency), currency: c.currency })}
              {c.goal ? <span className="text-body"> raised of {formatMoney({ amountMinor: toMinor(c.goal, c.currency), currency: c.currency })}</span> : <span className="text-body"> raised · no goal</span>}
            </p>
            {c.goal ? <ProgressBar percent={Math.min(100, c.percent)} tone="forest" animate={false} label={`${Math.round(c.percent)}% of the goal`} className="mt-2" /> : null}
            {c.others.length ? <p className="mt-2 text-[13px] text-body">Also: {c.others.map((o) => formatMoney({ amountMinor: toMinor(o.amount, o.currency), currency: o.currency })).join(" · ")}</p> : null}
            {!c.verified ? <p className="mt-2 text-[13px] font-semibold text-umber">Goal and breakdown not yet checked by finance</p> : null}
            {c.hasDraft ? <p className="mt-1 text-[13px] font-semibold text-umber">Has changes that aren’t live yet</p> : null}
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <CopyLink href={c.href} />
              {editable ? (
                <Link href={`/admin/giving/causes/${c.id}`} className="inline-flex h-10 items-center rounded-full bg-forest px-3.5 text-[13.5px] font-bold text-white hover:bg-deep">
                  Edit
                </Link>
              ) : null}
              <Link href={c.href} target="_blank" className="inline-flex h-10 items-center rounded-full border border-line px-3.5 text-[13.5px] font-bold text-ink hover:border-forest">
                View page
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
