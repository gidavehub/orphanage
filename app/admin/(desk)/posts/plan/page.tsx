import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanEditor } from "@/components/admin/posts/PlanEditor";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { saveDoc } from "@/lib/content/actions";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { loadSection } from "@/lib/studio/server";
import { monthlyDraftNowAction } from "../actions";
import { postsTabs } from "../tabs";

// Posts › Topics & milestones (admin-ux §6.12; PLAN D48): the month-by-month plan that steers the
// monthly draft, its settings, and "Draft this month's story now".

export const metadata: Metadata = { title: "Topics & milestones" };

export default function PlanPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Plan />
    </Suspense>
  );
}

async function Plan() {
  const v = await requireStaff("post.publish", "ai.manage");
  const d = await loadSection("settings.editorial");
  if (!d) notFound();
  return (
    <>
      <PageHeader title="Posts" description="What the monthly story should cover, and how the helper drafts it." tabs={postsTabs("plan", (p: Permission) => has(v, p))} />
      <PlanEditor d={d} save={saveDoc} draftNow={monthlyDraftNowAction} />
    </>
  );
}
