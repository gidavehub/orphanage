import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor } from "@/components/admin/posts/PostEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { getPostForEditor } from "@/lib/server/dal/posts";
import {
  approvePostAction,
  assistAction,
  notThisMonthAction,
  requestChangesAction,
  savePostAction,
  savePublishedPostAction,
  sendToSupportersAction,
  submitPostAction,
  supportersPreviewAction,
  unpublishPostAction,
} from "../actions";

// One post (admin-ux §6.12): the editor, the safety check and the next step for this stage.

export const metadata: Metadata = { title: "Post" };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPostForEditor(decodeURIComponent(id));
  if (!d) notFound();
  return (
    <>
      <PageHeader title={d.value.title} description={d.value.format === "update" ? "An update: one photo and one paragraph." : "An article for the News page."} back={{ label: "Posts", href: "/admin/posts" }} />
      <PostEditor
        key={`${d.id}:${d.status}`}
        d={d}
        actions={{
          save: savePostAction,
          saveLive: savePublishedPostAction,
          submit: submitPostAction,
          approve: approvePostAction,
          requestChanges: requestChangesAction,
          unpublish: unpublishPostAction,
          notThisMonth: notThisMonthAction,
          preview: supportersPreviewAction,
          send: sendToSupportersAction,
          assist: assistAction,
        }}
      />
    </>
  );
}
