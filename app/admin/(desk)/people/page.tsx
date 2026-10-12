import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Board } from "@/components/admin/people/Board";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ExportLinks } from "@/components/admin/ui/ExportLinks";
import type { Permission } from "@/lib/model/permissions";
import { has, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff, toShellViewer } from "@/lib/server/auth/session";
import { getVolunteerBoard } from "@/lib/server/dal/volunteers";
import { moveVolunteerAction } from "./actions";
import { peopleTabs } from "./tabs";

// People › Volunteers (admin-ux §6.9): a gentle kanban from Submitted to Active, with Inactive and
// Not this time resting in a tray.

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Volunteers />
    </Suspense>
  );
}

async function Volunteers() {
  const v = await requireStaff("volunteer.read", "volunteer.summary", "volunteer.manage", "partnership.read", "partnership.summary", "partnership.manage", "referralPartner.manage");
  const can = (p: Permission) => has(v, p);
  if (!hasAny(v, "volunteer.read", "volunteer.summary", "volunteer.manage")) redirect(hasAny(v, "partnership.read", "partnership.summary", "partnership.manage") ? "/admin/people/partners" : "/admin/people/directory");
  const board = await getVolunteerBoard();
  const open = board.cards.filter((c) => !["active", "inactive", "declined"].includes(c.status)).length;
  return (
    <>
      <PageHeader title="People" description="Volunteers, partners and the services we refer people to." tabs={peopleTabs("volunteers", can, { volunteers: open })} actions={can("volunteer.export") ? <ExportLinks dataset="volunteers" label="Volunteers" withContacts={can("volunteer.read")} /> : undefined} />
      <Board
        workflow="volunteer"
        lanes={["submitted", "screening", "interview", "approved", "onboarding", "active"]}
        resting={["inactive", "declined"]}
        cards={board.cards}
        perms={toShellViewer(v).perms}
        canManage={board.canManage}
        filters={board.interests}
        move={moveVolunteerAction}
      />
    </>
  );
}
