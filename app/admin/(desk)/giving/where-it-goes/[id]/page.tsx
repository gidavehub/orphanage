import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AllocationSummaryEditor } from "@/components/admin/giving/AllocationSummaryEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { saveItem } from "@/lib/content/actions";
import { getAllocationSummaryForEditor } from "@/lib/server/dal/allocations";

// One yearly "where the money went" summary (PLAN D57), finance and super admins.

export const metadata: Metadata = { title: "Yearly summary" };

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getAllocationSummaryForEditor(decodeURIComponent(id));
  if (!d) notFound();
  return (
    <>
      <PageHeader
        title={d.id === null ? "Add a yearly summary" : d.value.label}
        description="What came in and where it went, in each currency. Amounts in different currencies are never added together."
        back={{ label: "Where it goes", href: "/admin/giving/where-it-goes" }}
      />
      <AllocationSummaryEditor key={`${d.id}:${d.version}`} d={d} save={saveItem} />
    </>
  );
}
