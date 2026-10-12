import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PartnerView } from "@/components/admin/records/PartnerView";
import { VolunteerView } from "@/components/admin/records/VolunteerView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { kindOfRef, normaliseRef } from "@/lib/model/refs";
import { requireStaff } from "@/lib/server/auth/session";
import { getPartner } from "@/lib/server/dal/partnerships";
import { getPeopleTimeline, getVolunteer } from "@/lib/server/dal/volunteers";
import { addNote, seen } from "../../inbox/actions";
import { movePartnerAction, moveVolunteerAction, partnerFollowUpAction, safeguardingCheckAction, toggleChecklistAction, volunteerFollowUpAction } from "../actions";

// One volunteer application (HVN-VA-…) or partnership enquiry (HVN-PE-…) (admin-ux §6.9).

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decodeURIComponent(ref) };
}

export default function PersonPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const { ref: raw } = await params;
  const ref = normaliseRef(decodeURIComponent(raw)) ?? decodeURIComponent(raw);
  const kind = kindOfRef(ref);
  if (kind === "volunteer") {
    const v = await requireStaff("volunteer.read", "volunteer.manage");
    const [d, timeline] = await Promise.all([getVolunteer(ref), getPeopleTimeline(ref)]);
    return <VolunteerView d={d} timeline={timeline} tz={v.timezone} actions={{ move: moveVolunteerAction, checklist: toggleChecklistAction, followUp: volunteerFollowUpAction, check: safeguardingCheckAction, addNote, seen }} />;
  }
  if (kind === "partner") {
    const v = await requireStaff("partnership.read", "partnership.manage");
    const [d, timeline] = await Promise.all([getPartner(ref), getPeopleTimeline(ref)]);
    return <PartnerView d={d} timeline={timeline} tz={v.timezone} actions={{ move: movePartnerAction, followUp: partnerFollowUpAction, addNote, seen }} />;
  }
  notFound();
}
