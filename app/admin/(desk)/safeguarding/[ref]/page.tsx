import type { Metadata } from "next";
import { Suspense } from "react";
import { ConcernView } from "@/components/admin/safeguarding/ConcernView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { getSafety } from "@/lib/content/public";
import { requireStaff } from "@/lib/server/auth/session";
import { concernTimeline, openConcern } from "@/lib/server/dal/concerns";
import { concernAction, concernMove, concernRequestClose } from "../actions";

// The page title never says anything about the concern (admin-ux §6.5).
export const metadata: Metadata = { title: "Concern" };

export default function ConcernPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const v = await requireStaff("concern.read");
  const { ref: raw } = await params;
  const ref = decodeURIComponent(raw);
  const d = await openConcern(ref);
  const [timeline, safety] = await Promise.all([concernTimeline(ref), getSafety()]);
  return (
    <ConcernView
      d={d}
      timeline={timeline}
      tz={v.timezone}
      emergencyNotice={safety.emergencyNotice}
      actions={{ move: concernMove, addAction: concernAction, requestClose: concernRequestClose }}
    />
  );
}
