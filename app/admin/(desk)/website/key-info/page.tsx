import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyInfo } from "@/components/admin/studio/KeyInfo";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { restoreDocVersion, saveDoc } from "@/lib/content/actions";
import { DOCS } from "@/lib/content/registry";
import { DOC_IDS } from "@/lib/content/ids";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { loadSection } from "@/lib/studio/server";
import { websiteTabs } from "../tabs";

// Website › Key information (admin-ux §6.11; PLAN D51): contact details, social links, safety notices,
// menu messages and organisation details. Each card goes live straight away, with a 10-second Undo.

export const metadata: Metadata = { title: "Key information" };

export default function KeyInfoPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Cards />
    </Suspense>
  );
}

async function Cards() {
  const v = await requireStaff("content.read", "content.edit");
  const ids = DOC_IDS.filter((id) => DOCS[id].keyInfo === true);
  const cards = (await Promise.all(ids.map((id) => loadSection(id)))).filter((c) => c !== null);
  return (
    <>
      <PageHeader title="Website" description="The details that appear across the whole website." tabs={websiteTabs("key-info", (p) => has(v, p))} />
      <KeyInfo cards={cards} save={saveDoc} restore={restoreDocVersion} />
    </>
  );
}
