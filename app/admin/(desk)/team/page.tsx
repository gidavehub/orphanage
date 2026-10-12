import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { TeamList } from "@/components/admin/team/TeamList";
import { getTeam } from "@/lib/server/dal/staff";
import { resendInviteAction, revokeInviteAction } from "./actions";

// Team & roles (admin-ux §6.14; PLAN D88, D91), super admins only: who is on the team, what each
// person does, invitations still waiting, and people who have left (never deleted).

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHeader title="Team" description="Who works in Haven and what each person can open." />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Team />
      </Suspense>
    </>
  );
}

async function Team() {
  const t = await getTeam();
  return <TeamList members={t.members} invitations={t.invitations} now={t.now} resend={resendInviteAction} revoke={revokeInviteAction} />;
}
