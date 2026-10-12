import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, CircleAlert } from "lucide-react";
import { HideUnverifiedSwitch } from "@/components/admin/studio/HideUnverifiedSwitch";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { saveDoc } from "@/lib/content/actions";
import { getLaunchReadiness, type LaunchGroup } from "@/lib/content/launch";
import { loadDoc } from "@/lib/content/read";
import { contentStore } from "@/lib/content/store";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { websiteTabs } from "../tabs";

// Website › Before launch (PLAN D130; content-model §9): everything still to replace or confirm before
// the site goes public, with a link to where each is fixed, and the "Hide unverified figures" switch.

export const metadata: Metadata = { title: "Before launch" };

const GROUP: Record<LaunchGroup, string> = {
  content: "Words and examples",
  figures: "Figures",
  images: "Pictures",
  contact: "Contact details",
  partners: "Partners",
  policies: "Policies",
  setup: "Setup",
  data: "Data",
};

export default function LaunchPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} />}>
      <Checklist />
    </Suspense>
  );
}

async function Checklist() {
  const v = await requireStaff("content.publish");
  const [items, site, rec] = await Promise.all([getLaunchReadiness(), loadDoc("settings.site", { preview: true }), contentStore().getDoc("settings.site")]);
  const open = items.filter((i) => !i.done);
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <>
      <PageHeader title="Website" description="What to replace or confirm before the site goes public." tabs={websiteTabs("launch", (p) => has(v, p))} />
      <div className="grid gap-5">
        <section aria-labelledby="switch" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="switch" className="text-[18px] font-extrabold text-ink">
            Example figures
          </h2>
          <p className="mt-1 text-[14.5px] text-body">While figures are examples, the site marks them as illustrative. Before launch, hide every figure finance or programmes haven’t checked.</p>
          <HideUnverifiedSwitch value={site.figures.hideUnverified} version={rec?.version ?? 0} site={site} canChange={v.roles.includes("super_admin")} save={saveDoc} />
        </section>
        <p className="text-[15px] font-semibold text-ink">{open.length ? `${open.length} thing${open.length === 1 ? "" : "s"} still to do.` : "Everything is ready."}</p>
        {groups.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="rounded-[22px] bg-white p-5 shadow-soft">
            <h2 id={`g-${g}`} className="mb-3 text-[17px] font-extrabold text-ink">
              {GROUP[g]}
            </h2>
            <ul className="grid gap-3">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.id} className="flex gap-3">
                    {i.done ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" /> : <CircleAlert aria-hidden className={`mt-0.5 size-5 shrink-0 ${i.severity === "must" ? "text-coral-800" : "text-umber"}`} />}
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-ink">
                        {i.title} {!i.done && i.severity === "must" ? <span className="ml-1 rounded-full bg-coral/10 px-2 py-0.5 text-[11.5px] font-bold text-coral-800">Before launch</span> : null}
                      </p>
                      {!i.done ? <p className="text-[14px] text-body">{i.detail}</p> : null}
                      {!i.done && i.examples?.length ? <p className="mt-1 text-[13px] text-body">{i.examples.slice(0, 6).join(" · ")}</p> : null}
                      {!i.done ? (
                        <Link href={i.href} className="mt-1 inline-flex text-[14px] font-bold text-forest underline-offset-4 hover:underline">
                          Fix it
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
