import { Suspense } from "react";
import { ReportRequestsList } from "@/components/admin/library/ReportRequestsList";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SplitView } from "@/components/admin/shell/SplitView";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listReportRequests } from "@/lib/server/dal/reportRequests";
import { libraryTabs } from "../tabs";

// Reports & resources › Requests (admin-ux §6.8, §3.8 split view): people asking for a controlled
// report. The list stays in the layout while a request opens beside it.

async function Header() {
  const v = await requireStaff("reportRequest.read", "reportRequest.manage");
  const { counts } = await listReportRequests("open");
  return <PageHeader title="Reports & resources" description="People asking for a report: approve and the link goes by email." tabs={libraryTabs("requests", (p: Permission) => has(v, p), counts.open)} />;
}

async function ListData() {
  await requireStaff("reportRequest.read", "reportRequest.manage");
  const [open, done] = await Promise.all([listReportRequests("open"), listReportRequests("done")]);
  return <ReportRequestsList open={open.rows} done={done.rows} />;
}

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Reports & resources" />}>
        <Header />
      </Suspense>
      <SplitView
        listLabel="Report requests"
        detailLabel="Open request"
        list={
          <Suspense fallback={<ListSkeleton />}>
            <ListData />
          </Suspense>
        }
      >
        {children}
      </SplitView>
    </>
  );
}
