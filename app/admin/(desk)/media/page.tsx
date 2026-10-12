import type { Metadata } from "next";
import { Suspense } from "react";
import { MediaLibrary } from "@/components/admin/media/MediaLibrary";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { listMediaForStaff } from "@/lib/server/dal/media";
import { updatePhotoAction, withdrawPhotoAction } from "./actions";

// Photos & files (admin-ux §6.13): the library every page picks pictures from.

export const metadata: Metadata = { title: "Photos" };

export default function MediaPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const { items, canUpload, canConsent } = await listMediaForStaff();
  return (
    <>
      <PageHeader title="Photos & films" description="Every picture the website can use, with its description and consent." />
      <MediaLibrary items={items} canUpload={canUpload} canConsent={canConsent} update={updatePhotoAction} withdraw={withdrawPhotoAction} />
    </>
  );
}
