import { Suspense } from "react";
import { ConcernList } from "@/components/admin/safeguarding/ConcernList";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { RestrictedBanner } from "@/components/admin/shell/RestrictedBanner";
import { SplitView } from "@/components/admin/shell/SplitView";
import { listConcerns } from "@/lib/server/dal/concerns";

// Safeguarding (admin-ux §6.5): a quieter, restricted place. Safeguarding officers and super admins
// only, with a sign-in in the last 30 minutes (the DAL redirects to "Confirm it's you"). Everyone else
// gets NoAccess. The list carries only safe fields.

async function ConcernListData() {
  const { open, closed, at } = await listConcerns();
  return <ConcernList open={open} closed={closed} now={at} />;
}

export default function SafeguardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 min-h-[70dvh] rounded-[26px] bg-[#e7eeeb] px-4 pb-8 pt-4 sm:-mx-6 sm:px-6">
      <h1 className="sr-only">Safeguarding</h1>
      <RestrictedBanner label="Safeguarding team only" />
      <SplitView
        listLabel="Concerns"
        detailLabel="Open concern"
        list={
          <Suspense fallback={<ListSkeleton />}>
            <ConcernListData />
          </Suspense>
        }
      >
        {children}
      </SplitView>
    </div>
  );
}
