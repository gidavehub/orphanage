import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SponsorEditor } from "@/components/admin/giving/SponsorEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { getSponsorForEditor } from "@/lib/server/dal/sponsors";
import { addSponsorUpdateAction, publishSponsorAction, saveSponsorAction, setSponsorStatusAction } from "../actions";

// One sponsorship profile (PLAN D55): the need, the counts, the safety check and programme-level updates.

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: code === "new" ? "New sponsorship profile" : decodeURIComponent(code) };
}

export default function SponsorPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = await getSponsorForEditor(decodeURIComponent(code));
  if (!d) notFound();
  return (
    <>
      <PageHeader
        title={d.code ?? "New sponsorship profile"}
        description="What sponsors see: an age band, the need and how many sponsors it takes. Never a name, a town or medical history."
        back={{ label: "Sponsorship", href: "/admin/giving/sponsorship" }}
      />
      <SponsorEditor key={`${d.code}:${d.version}`} d={d} actions={{ save: saveSponsorAction, publish: publishSponsorAction, setStatus: setSponsorStatusAction, addUpdate: addSponsorUpdateAction }} />
    </>
  );
}
