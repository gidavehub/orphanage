import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportRequestView } from "@/components/admin/records/ReportRequestView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { getReportRequest } from "@/lib/server/dal/reportRequests";
import { moveReportRequestAction, revealRequesterEmailAction } from "../../actions";

// One report request (admin-ux §6.8), beside the list.

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decodeURIComponent(ref) };
}

export default function ReportRequestPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const d = await getReportRequest(decodeURIComponent(ref));
  return <ReportRequestView key={`${d.ref}:${d.version}`} d={d} move={moveReportRequestAction} reveal={revealRequesterEmailAction} />;
}
