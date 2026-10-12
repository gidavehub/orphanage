import type { Metadata } from "next";
import { Suspense } from "react";
import { PostsList } from "@/components/admin/posts/PostsList";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listPostsForStaff } from "@/lib/server/dal/posts";
import { postsTabs } from "./tabs";

// Posts (admin-ux §6.12): updates and articles by stage, and the monthly draft waiting for review.

export const metadata: Metadata = { title: "Posts" };

export default function PostsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Posts />
    </Suspense>
  );
}

async function Posts() {
  const v = await requireStaff("post.draft", "post.publish");
  const { rows, counts, canPublish, at } = await listPostsForStaff();
  return (
    <>
      <PageHeader title="Posts" description="Updates and articles for the News page, and the monthly story." tabs={postsTabs("posts", (p: Permission) => has(v, p))} />
      <PostsList rows={rows} counts={counts} canPublish={canPublish} now={at} />
    </>
  );
}
