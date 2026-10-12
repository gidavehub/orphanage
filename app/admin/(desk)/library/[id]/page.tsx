import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceEditor } from "@/components/admin/library/ResourceEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { getResourceForEditor } from "@/lib/server/dal/resources";
import { saveResourceAction } from "../actions";

// Add or edit a library item (admin-ux §6.8). `new` adds one.

export const metadata: Metadata = { title: "Report or resource" };

export default function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getResourceForEditor(decodeURIComponent(id));
  if (!d) notFound();
  return (
    <>
      <PageHeader title={d.id ? d.value.title || "Report or resource" : "Add a report or resource"} description="A guide, policy or report for the library." back={{ label: "Reports & resources", href: "/admin/library" }} />
      <ResourceEditor key={`${d.id}:${d.version}`} d={d} save={saveResourceAction} />
    </>
  );
}
