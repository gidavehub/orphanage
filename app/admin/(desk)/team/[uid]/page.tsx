import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { PersonView } from "@/components/admin/team/PersonView";
import { getPerson } from "@/lib/server/dal/staff";
import { resetCodeAction, setRolesAction, setStatusAction } from "../actions";

// One person on the team (admin-ux §6.14): roles, what they open, devices, pause or switch off.

export const metadata: Metadata = { title: "Team member" };

export default function PersonPage({ params }: { params: Promise<{ uid: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Person params={params} />
    </Suspense>
  );
}

async function Person({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const p = /^[A-Za-z0-9_-]{6,128}$/.test(uid) ? await getPerson(uid) : null;
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.name} description={p.roleNames.join(", ")} back={{ label: "Team", href: "/admin/team" }} />
      <PersonView key={`${p.uid}:${p.version}`} p={p} saveRoles={setRolesAction} setStatus={setStatusAction} resetCode={resetCodeAction} />
    </>
  );
}
