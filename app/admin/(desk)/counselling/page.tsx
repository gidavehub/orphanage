import type { Metadata } from "next";
import { Suspense } from "react";
import { Agenda } from "@/components/admin/counselling/Agenda";
import { BookSessionButton } from "@/components/admin/counselling/BookSessionButton";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getAgenda } from "@/lib/server/dal/appointments";
import { moveSessionAction } from "./actions";

// Sessions (admin-ux §6.7): the week strip, the day's agenda, attendance to record and, for programme
// officers, "Waiting for a time". Counsellors see only their own sessions ("My sessions").

export const metadata: Metadata = { title: "Sessions" };

export default function CounsellingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Sessions searchParams={searchParams} />
    </Suspense>
  );
}

async function Sessions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireStaff("appointment.manage", "appointment.own");
  const sp = await searchParams;
  const d = await getAgenda({ day: typeof sp.day === "string" ? sp.day : null, counsellor: typeof sp.counsellor === "string" ? sp.counsellor : null });
  const manage = has(v, "appointment.manage");
  return (
    <>
      <PageHeader
        title={manage ? "Sessions" : "My sessions"}
        description={manage ? "Counselling sessions, who's waiting for a time, and how each one went." : "Your counselling sessions and how each one went."}
        actions={manage ? <BookSessionButton /> : undefined}
      />
      <Agenda d={d} move={moveSessionAction} />
    </>
  );
}
