import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { getEmailPreview } from "@/lib/server/dal/settings";

// One email from the log (admin-ux §6.16): exactly what the person gets, in a sandboxed frame (no
// scripts, no same-origin access, links open nothing inside the admin).

export const metadata: Metadata = { title: "Email" };

export default function EmailPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  let id = "";
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const e = await getEmailPreview(id);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={e.subject} description={`To ${e.to}`} back={{ label: "Email log", href: "/admin/settings/email-log" }} />
      <div className="overflow-hidden rounded-[22px] bg-white shadow-soft">
        <iframe title={`Preview: ${e.subject}`} sandbox="" referrerPolicy="no-referrer" srcDoc={e.html} className="block h-[75vh] min-h-[520px] w-full border-0 bg-white" />
      </div>
    </>
  );
}
