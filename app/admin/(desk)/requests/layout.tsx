import { Suspense } from "react";
import { RequestsList } from "@/components/admin/records/RequestsList";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SplitView } from "@/components/admin/shell/SplitView";
import { requireStaff } from "@/lib/server/auth/session";
import { listRequests } from "@/lib/server/dal/support";

// Requests (admin-ux §6.4 list, §3.8 split view): every support request this person may see, by
// stage, mine or everyone's. The list stays in the layout (streamed in Suspense) while a request
// opens beside it.

async function RequestsListData() {
  await requireStaff("support.read", "support.summary", "support.manage");
  const [open, done, mine] = await Promise.all([
    listRequests({ stage: "open", limit: 100 }),
    listRequests({ stage: "completed", limit: 50 }),
    listRequests({ stage: "open", who: "mine", limit: 100 }),
  ]);
  return <RequestsList all={[...open.items, ...done.items]} mine={mine.items} counts={open.counts} now={open.at} />;
}

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Requests" description="Every request for support, from first contact to the help given." />
      <SplitView
        listLabel="Requests"
        detailLabel="Open request"
        list={
          <Suspense fallback={<ListSkeleton />}>
            <RequestsListData />
          </Suspense>
        }
      >
        {children}
      </SplitView>
    </>
  );
}
