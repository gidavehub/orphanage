import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/admin/records/SessionView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { getSession } from "@/lib/server/dal/appointments";
import { zoomApiOn } from "@/lib/server/zoom/meetings";
import { addSessionNoteAction, createZoomAction, moveSessionAction, reassignSessionAction, sendInvitationAction, setZoomLinkAction, startAsHostAction } from "../actions";

// One counselling session (admin-ux §6.7). Counsellors open only their own; anyone else gets NoAccess.

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decodeURIComponent(ref) };
}

export default function SessionPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const d = await getSession(decodeURIComponent(ref));
  return (
    <SessionView
      key={`${d.ref}:${d.version}`}
      d={d}
      actions={{
        move: moveSessionAction,
        setZoom: setZoomLinkAction,
        reassign: reassignSessionAction,
        invite: sendInvitationAction,
        addNote: addSessionNoteAction,
        ...(zoomApiOn() ? { createZoom: createZoomAction, startAsHost: startAsHostAction } : {}),
      }}
    />
  );
}
