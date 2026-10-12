import type { Metadata } from "next";
import { Suspense } from "react";
import { Directory } from "@/components/admin/people/Directory";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listReferralPartners } from "@/lib/server/dal/referralPartners";
import { saveReferralPartnerAction } from "../actions";
import { peopleTabs } from "../tabs";

// People › Directory (admin-ux §6.9): the services Haven refers people to.

export const metadata: Metadata = { title: "Directory" };

export default function DirectoryPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Entries />
    </Suspense>
  );
}

async function Entries() {
  const v = await requireStaff("referralPartner.manage");
  const { rows, canEdit } = await listReferralPartners();
  return (
    <>
      <PageHeader title="People" description="Volunteers, partners and the services we refer people to." tabs={peopleTabs("directory", (p: Permission) => has(v, p))} />
      <Directory rows={rows} canEdit={canEdit} save={saveReferralPartnerAction} />
    </>
  );
}
