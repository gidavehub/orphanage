import type { Metadata } from "next";
import { Suspense } from "react";
import { Board } from "@/components/admin/people/Board";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ExportLinks } from "@/components/admin/ui/ExportLinks";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff, toShellViewer } from "@/lib/server/auth/session";
import { getPartnerBoard } from "@/lib/server/dal/partnerships";
import { movePartnerAction } from "../actions";
import { peopleTabs } from "../tabs";

// People › Partners (admin-ux §6.9; PLAN D78): New · Under review · Talking · Agreement · Active, with
// Closed and Not this time resting in a tray.

export const metadata: Metadata = { title: "Partners" };

export default function PartnersPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Partners />
    </Suspense>
  );
}

async function Partners() {
  const v = await requireStaff("partnership.read", "partnership.summary", "partnership.manage");
  const can = (p: Permission) => has(v, p);
  const board = await getPartnerBoard();
  const open = board.cards.filter((c) => !["active", "closed", "declined"].includes(c.status)).length;
  return (
    <>
      <PageHeader title="People" description="Volunteers, partners and the services we refer people to." tabs={peopleTabs("partners", can, { partners: open })} actions={can("partnership.export") ? <ExportLinks dataset="partners" label="Partners" withContacts={can("partnership.read")} /> : undefined} />
      <Board
        workflow="partnership"
        lanes={["new", "under_review", "in_discussion", "agreed", "active"]}
        resting={["closed", "declined"]}
        cards={board.cards}
        perms={toShellViewer(v).perms}
        canManage={board.canManage}
        filters={board.interests}
        move={movePartnerAction}
      />
    </>
  );
}
