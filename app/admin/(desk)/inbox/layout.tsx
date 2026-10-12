import { Suspense } from "react";
import { InboxList } from "@/components/admin/records/InboxList";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SplitView } from "@/components/admin/shell/SplitView";
import { AREA_PERMS } from "@/lib/admin/access";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { inboxKindsFor } from "@/lib/server/dal/inbox";
import { listInbox } from "@/lib/server/dal/records";
import { snooze, take } from "./actions";

// The Inbox (admin-ux §6.3, §3.8 split view): the list lives in this layout so it stays put while a
// record opens beside it; phones show one pane at a time. The list streams in its own Suspense
// boundary. Server Actions call refresh(), which re-renders it in the same round trip.

const KIND_LABEL: Record<string, string> = {
  requests: "Requests",
  concerns: "Concerns",
  gifts: "Gifts",
  inkind: "In-kind",
  reports: "Reports",
  volunteers: "Volunteers",
  partners: "Partners",
  messages: "Messages",
  stories: "Stories",
};

async function InboxListData() {
  const v = await requireStaff(...AREA_PERMS.inbox.read);
  const [fresh, later, mine] = await Promise.all([listInbox({ tab: "new", limit: 100 }), listInbox({ tab: "later", limit: 100 }), listInbox({ tab: "mine", limit: 100 })]);
  const canWrite = (["support.manage", "donation.manage", "contact.manage", "volunteer.manage", "partnership.manage", "reportRequest.manage", "storySubmission.manage"] as const).some((p) => has(v, p));
  return (
    <InboxList
      lists={{ new: fresh.items, later: later.items, mine: mine.items }}
      kinds={inboxKindsFor(v).map((k) => ({ id: k, label: KIND_LABEL[k] ?? k }))}
      now={fresh.at}
      canWrite={canWrite}
      actions={{ take, snooze }}
    />
  );
}

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Inbox" description="Everything new that needs a first reply. Take something to make it yours." />
      <SplitView
        listLabel="Inbox"
        detailLabel="Open item"
        list={
          <Suspense fallback={<ListSkeleton />}>
            <InboxListData />
          </Suspense>
        }
      >
        {children}
      </SplitView>
    </>
  );
}
