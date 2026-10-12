"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, PenLine, Sparkles } from "lucide-react";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusOf } from "@/lib/model/status";
import type { PostRowDTO } from "@/lib/server/dal/posts";
import { cn } from "@/lib/cn";

type S = StatusOf<"post">;
const TABS: Array<{ id: S; label: string }> = [
  { id: "draft", label: "Drafts" },
  { id: "in_review", label: "Waiting for review" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Live" },
  { id: "archived", label: "Taken down" },
];
const when = (ms: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul" }).format(ms);
const ago = (ms: number, now: number) => {
  const d = Math.floor((now - ms) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

/** Posts (admin-ux §6.12): tabs by stage, the AI draft banner, and quick ways to post. */
export function PostsList({ rows, counts, canPublish, now }: { rows: PostRowDTO[]; counts: Partial<Record<S, number>>; canPublish: boolean; now: number }) {
  const router = useRouter();
  const ai = rows.find((r) => r.status === "in_review" && r.origin === "ai_monthly");
  const [tab, setTab] = useState<S>(counts.in_review ? "in_review" : "draft");
  const shown = rows.filter((r) => r.status === tab);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Stage">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("h-10 shrink-0 rounded-full px-4 text-[14px] font-bold", tab === t.id ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
              {t.label} {counts[t.id] ?? 0}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="forest" size="sm" icon="none" onClick={() => openGlobalSheet(router, "post-update")}>
            <PenLine aria-hidden className="size-4" /> Post an update
          </Button>
          {canPublish ? (
            <Button type="button" variant="outline" size="sm" icon="none" onClick={() => openGlobalSheet(router, "write-article")}>
              <FileText aria-hidden className="size-4" /> Write an article
            </Button>
          ) : null}
        </div>
      </div>
      {ai ? (
        <Link href={`/admin/posts/review/${ai.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-marigold-100 p-4 text-umber hover:bg-marigold/30">
          <span className="inline-flex items-center gap-2 text-[15px] font-bold">
            <Sparkles aria-hidden className="size-5" /> This month’s draft is ready to review · drafted by the writing helper
          </span>
          <span className="rounded-full bg-white px-4 py-2 text-[14px] font-bold text-ink">Review</span>
        </Link>
      ) : null}
      {shown.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">Nothing here.</p>
      ) : (
        <ul className="grid gap-2.5">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/posts/${r.id}`} className="flex items-center gap-3 rounded-[20px] bg-white p-3 shadow-soft hover:bg-sand/40">
                {r.coverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverSrc} alt="" className="h-16 w-20 shrink-0 rounded-[12px] object-cover" />
                ) : (
                  <span className="h-16 w-20 shrink-0 rounded-[12px] bg-sand" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-bold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-body">
                    {r.format === "update" ? "Update" : "Article"} · {r.category}
                    {r.status === "scheduled" && r.publishAt ? ` · goes live ${when(r.publishAt)}` : r.status === "published" && r.publishedAt ? ` · ${ago(r.publishedAt, now)}` : ` · edited ${ago(r.updatedAt, now)}`}
                    {r.origin !== "human" ? " · writing helper" : ""}
                    {r.hasDraft ? " · changes not live" : ""}
                  </p>
                </div>
                <StatusPill workflow="post" status={r.status} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
