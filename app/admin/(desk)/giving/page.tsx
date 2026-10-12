import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GivingLedger } from "@/components/admin/giving/GivingLedger";
import { PayLinksPanel } from "@/components/admin/giving/PayLinksPanel";
import { RecordGiftButton } from "@/components/admin/giving/RecordGiftButton";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ExportLinks } from "@/components/admin/ui/ExportLinks";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { AREA_PERMS } from "@/lib/admin/access";
import { listGifts } from "@/lib/server/dal/donations";
import { features } from "@/lib/server/env";
import { payLaterPledges } from "@/lib/server/payments/pay";
import { sendPayLinksAction } from "./actions";
import { firstGivingTab, givingTabs } from "./tabs";

// Giving › Gifts (admin-ux §6.6): the ledger for a month, totals per currency, filters in the URL.
// Single gifts and donor names need donation.read; people who come to Giving for totals, causes or
// sponsorship land on the first tab they can open.

export const metadata: Metadata = { title: "Giving" };

export default function GivingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<ListSkeleton rows={8} />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

async function Ledger({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The Giving area (its place in the nav); content editors without it reach causes through the website.
  const v = await requireStaff(...AREA_PERMS.giving.read);
  const can = (p: Permission) => has(v, p);
  if (!can("donation.read") && !can("donation.manage")) {
    const to = firstGivingTab(can);
    if (to && to !== "/admin/giving") redirect(to);
    await requireStaff("donation.read", "donation.manage");
  }
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : null;
  const [ledger, payLater] = await Promise.all([listGifts({ month }), features.stripe && can("donation.manage") ? payLaterPledges().catch(() => []) : Promise.resolve([])]);
  return (
    <>
      <PageHeader title="Giving" description="Every gift, thanked and put towards the right place." tabs={givingTabs("gifts", can)} actions={
          can("donation.manage") || can("donation.export") ? (
            <>
              {can("donation.export") ? <ExportLinks dataset="donations" label="Gifts" withContacts={can("donation.contact")} /> : null}
              {can("donation.manage") ? <RecordGiftButton /> : null}
            </>
          ) : undefined
        }
      />
      <PayLinksPanel pledges={payLater} send={sendPayLinksAction} />
      <GivingLedger ledger={ledger} />
    </>
  );
}
