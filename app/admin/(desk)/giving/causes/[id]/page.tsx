import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CauseEditor } from "@/components/admin/giving/CauseEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { saveItem } from "@/lib/content/actions";
import { AREA_PERMS } from "@/lib/admin/access";
import { requireStaff } from "@/lib/server/auth/session";
import { getCauseForEditor } from "@/lib/server/dal/causes";

// Giving › Causes › one cause (admin-ux §6.6): words and picture for the content team, goal,
// currency and breakdown for finance. `new` adds a cause.

export const metadata: Metadata = { title: "Cause" };

export default function CausePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(...AREA_PERMS.giving.read);
  const d = await getCauseForEditor(decodeURIComponent(id));
  if (!d || (d.id === null && !d.can.create)) notFound();
  return (
    <>
      <PageHeader
        title={d.id === null ? "Add a cause" : d.value.title || "Cause"}
        description={d.id === null ? "A new appeal or cause donors can give to." : "What donors see on its donate page, and where the money goes."}
        back={{ label: "Causes", href: "/admin/giving/causes" }}
      />
      <CauseEditor key={`${d.id}:${d.version}`} d={d} save={saveItem} />
    </>
  );
}
