import type { Metadata } from "next";
import { Suspense } from "react";
import { GivingSettings } from "@/components/admin/giving/GivingSettings";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { saveDoc } from "@/lib/content/actions";
import { getGivingSettings } from "@/lib/server/dal/paymentSettings";
import { savePaymentSettingsAction } from "./actions";

// Settings › Giving (admin-ux §6.16; PLAN D63, D131), finance and super admins: how each currency is
// paid, bank and mobile-money details, receipts and thank-yous, helper rates, and what donors choose
// from (donate.config).

export const metadata: Metadata = { title: "Giving settings" };

export default function GivingSettingsPage() {
  return (
    <>
      <PageHeader title="Giving settings" description="How people pay, what they choose from, and what their receipt says." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<RecordSkeleton />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const d = await getGivingSettings();
  return <GivingSettings key={`${d.baseUpdatedAt}:${d.donate.version}`} d={d} savePayment={savePaymentSettingsAction} saveDonate={saveDoc} />;
}
