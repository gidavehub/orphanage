import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangesPanel } from "@/components/admin/studio/ChangesPanel";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { publishAll } from "@/lib/content/actions";
import { listDrafts } from "@/lib/content/store";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listActivity } from "@/lib/server/dal/activity";
import { draftChangesAction, undoChangeAction } from "../actions";
import { websiteTabs } from "../tabs";

// Website › Changes (admin-ux §6.10 step 5): what isn't live yet, and what was put live recently.

export const metadata: Metadata = { title: "Website changes" };

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul" });

export default function ChangesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Changes />
    </Suspense>
  );
}

async function Changes() {
  const v = await requireStaff("content.read", "content.edit");
  const [drafts, recent] = await Promise.all([listDrafts(), listActivity({ area: "content", limit: 40 }).catch(() => ({ items: [], nextCursor: null }))]);
  return (
    <>
      <PageHeader title="Website" description="Changes not live yet, and what was put live recently." tabs={websiteTabs("changes", (p) => has(v, p))} />
      <div className="grid gap-5">
        <ChangesPanel count={drafts.length} canPublish={has(v, "content.publish")} actions={{ load: draftChangesAction, publishAll, undo: undoChangeAction }} />
        <section aria-labelledby="recent" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="recent" className="mb-3 text-[18px] font-extrabold text-ink">
            Recently
          </h2>
          {recent.items.length === 0 ? (
            <p className="text-[15px] text-body">Nothing yet.</p>
          ) : (
            <ol className="grid gap-2">
              {recent.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-[14.5px] last:border-0">
                  <span className="text-ink">{a.sentence}</span>
                  <span className="text-[12.5px] text-body">{when.format(a.at)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[13px] text-body">To bring back an earlier version, open the section in the studio: earlier versions are kept for each one.</p>
        </section>
      </div>
    </>
  );
}
