import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Download, FileText, Lock } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import type { Permission } from "@/lib/model/permissions";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { listReportRequests } from "@/lib/server/dal/reportRequests";
import { listResourcesForStaff } from "@/lib/server/dal/resources";
import { libraryTabs } from "./tabs";

// Reports & resources › Resources (admin-ux §6.8): every library item as a card with its category,
// who can get it, and its downloads or requests. Report managers land on Requests.

export const metadata: Metadata = { title: "Reports & resources" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Resources />
    </Suspense>
  );
}

async function Resources() {
  const v = await requireStaff("resource.manage", "reportRequest.read", "reportRequest.manage");
  const can = (p: Permission) => has(v, p);
  if (!can("resource.manage")) redirect("/admin/library/requests");
  const [{ rows }, requests] = await Promise.all([listResourcesForStaff(), can("reportRequest.read") || can("reportRequest.manage") ? listReportRequests("open") : Promise.resolve(null)]);
  return (
    <>
      <PageHeader
        title="Reports & resources"
        description="Guides, policies and reports: free downloads, or sent to people who ask."
        tabs={libraryTabs("resources", can, requests?.counts.open)}
        actions={
          <Button href="/admin/library/new" variant="forest" size="sm" icon="plus" iconFirst>
            Add a report or resource
          </Button>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/library/${r.id}`} className="group flex h-full flex-col overflow-hidden rounded-[22px] bg-white shadow-soft transition-shadow hover:shadow-card-hover">
              <div className="relative aspect-[16/9] bg-forest">
                {r.coverSrc ? (
                  <Image src={r.coverSrc} alt="" fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 90vw" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center p-5 text-center">
                    <p className="line-clamp-3 font-display text-[22px] leading-tight text-white">{r.title}</p>
                  </div>
                )}
                {!r.showing ? <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-umber">Hidden</span> : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-[16.5px] font-extrabold leading-snug text-ink group-hover:text-forest">{r.title}</h2>
                <p className="mt-1 text-[13px] font-semibold text-body">{RESOURCE_CATEGORY_LABEL[r.category]}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[13px]">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${r.access === "public" ? "bg-mint text-deep" : "bg-sand text-umber"}`}>
                    {r.access === "public" ? <Download aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
                    {r.access === "public" ? "Free download" : "On request"}
                  </span>
                  {!r.hasFile ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-marigold-100 px-2.5 py-1 font-bold text-umber">
                      <FileText aria-hidden className="size-3.5" /> No file yet
                    </span>
                  ) : null}
                  <span className="text-body">{r.access === "public" ? `${r.downloads} download${r.downloads === 1 ? "" : "s"}` : `${r.requests} request${r.requests === 1 ? "" : "s"}${r.waiting ? ` · ${r.waiting} waiting` : ""}`}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
