import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Studio } from "@/components/admin/studio/Studio";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { publishAll, reorderItems, saveDoc, saveItem, setItemVisibility } from "@/lib/content/actions";
import { listDrafts } from "@/lib/content/store";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { STUDIO_PAGES, sectionLabels, studioPage } from "@/lib/studio/registry";
import { draftChangesAction, loadCollectionAction, loadSectionAction, undoChangeAction } from "../actions";
import { websiteTabs } from "../tabs";

// Website › one page in the studio (admin-ux §6.10): the live page in Draft Mode beside its sections.

export const metadata: Metadata = { title: "Website" };

export default function WebsitePage({ params }: { params: Promise<{ page: string }> }) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <StudioPanel params={params} />
    </Suspense>
  );
}

async function StudioPanel({ params }: { params: Promise<{ page: string }> }) {
  const v = await requireStaff("content.read", "content.edit");
  const { page: key } = await params;
  const page = studioPage(decodeURIComponent(key));
  if (!page) notFound();
  const drafts = (await listDrafts()).length;
  return (
    <>
      <PageHeader title="Website" description="Change what visitors see. Edits stay a draft until you put them live." tabs={websiteTabs("pages", (p) => has(v, p))} />
      <Studio
        pages={STUDIO_PAGES.map((p) => ({ key: p.key, label: p.label }))}
        page={page}
        labels={sectionLabels()}
        drafts={drafts}
        canPublish={has(v, "content.publish")}
        actions={{
          loadSection: loadSectionAction,
          saveDoc,
          collection: { load: loadCollectionAction, save: saveItem, visibility: setItemVisibility, reorder: reorderItems },
          publish: { load: draftChangesAction, publishAll, undo: undoChangeAction },
        }}
      />
    </>
  );
}
