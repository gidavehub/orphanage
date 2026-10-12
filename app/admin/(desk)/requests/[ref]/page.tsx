import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportPanel } from "../../_records/panels";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decodeURIComponent(ref) };
}

export default function RequestPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <SupportPanel reference={decodeURIComponent(ref)} context="place" />;
}
