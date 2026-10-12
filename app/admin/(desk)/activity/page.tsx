import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { formatStaffDate } from "@/lib/admin/format";
import type { ActivityArea } from "@/lib/model/dto";
import { adminHrefOfRef } from "@/lib/model/refs";
import { listActivityLog } from "@/lib/server/dal/activity";
import { cn } from "@/lib/cn";

// Activity (admin-ux §6.15; PLAN D93): who did what, and when, in the areas this person may read.
// Audit readers also get "Only sensitive" (views, reveals, exports, sign-ins and access changes) and
// everything one person did. Sentences never carry sensitive content (they're written that way).

export const metadata: Metadata = { title: "Activity" };

const AREA: Record<ActivityArea, string> = {
  auth: "Sign-ins",
  support: "Support",
  safeguarding: "Safeguarding",
  counselling: "Counselling",
  donations: "Giving",
  engagement: "People",
  resources: "Library",
  content: "Website & posts",
  staff: "Team",
  settings: "Settings",
  privacy: "Privacy",
  export: "Downloads",
  system: "Haven",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Activity" description="Who did what, and when. Nothing here can be changed or deleted." />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function href(q: { area?: string | null; only?: string | null; who?: string | null; cursor?: string | null }) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/activity?${s}` : "/admin/activity";
}

async function Feed({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const area = one(sp.area);
  const only = one(sp.only) === "sensitive" ? "sensitive" : null;
  const who = one(sp.who);
  const log = await listActivityLog({ area, sensitive: only === "sensitive", who, cursor: one(sp.cursor) });
  const whoName = who ? (log.items.find((i) => i.actor?.uid === who)?.actor?.name ?? "one person") : null;

  const groups: Array<{ day: string; items: typeof log.items }> = [];
  for (const i of log.items) {
    const day = formatStaffDate(i.at, log.tz, "short");
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(i);
    else groups.push({ day, items: [i] });
  }
  const today = formatStaffDate(log.now, log.tz, "short");
  const yesterday = formatStaffDate(log.now - 86_400_000, log.tz, "short");
  const chip = (on: boolean) =>
    cn("inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-bold transition-colors", on ? "bg-forest text-white" : "bg-white text-ink shadow-chip hover:bg-mint");

  return (
    <div className="grid gap-5">
      <nav aria-label="Filter activity" className="grid gap-3">
        <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <li>
            <Link href={href({ only, who })} aria-current={!area ? "page" : undefined} className={chip(!area)}>
              Everything
            </Link>
          </li>
          {log.areas.map((a) => (
            <li key={a}>
              <Link href={href({ area: a, only, who })} aria-current={area === a ? "page" : undefined} className={chip(area === a)}>
                {AREA[a]}
              </Link>
            </li>
          ))}
        </ul>
        {log.full ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ area, only: only ? null : "sensitive", who })} aria-current={only === "sensitive" ? "true" : undefined} className={chip(only === "sensitive")}>
              <Lock aria-hidden className="size-3.5" /> Only sensitive
            </Link>
            {who ? (
              <Link href={href({ area, only })} className={chip(true)}>
                Only {whoName} <span aria-hidden>×</span>
                <span className="sr-only">(show everyone)</span>
              </Link>
            ) : null}
            <span className="text-[13.5px] text-body">{only ? "Record views, reveals, downloads, sign-ins and access changes." : "Tap someone’s picture to see everything they did."}</span>
          </div>
        ) : null}
      </nav>

      {groups.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">Nothing here yet.</p>
      ) : (
        groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h2 className="mb-2 text-[14px] font-extrabold uppercase tracking-[0.04em] text-body">{g.day === today ? "Today" : g.day === yesterday ? "Yesterday" : g.day}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-soft">
              {g.items.map((i) => (
                <li key={i.id} data-sensitive={i.sensitive || undefined} className="flex items-start gap-3 px-4 py-3">
                  {i.actor ? (
                    log.full ? (
                      <Link href={href({ who: i.actor.uid, only })} aria-label={`Everything ${i.actor.name} did`} className="shrink-0 rounded-full">
                        <Avatar name={i.actor.name} uid={i.actor.uid} tone={i.actor.tone} size={28} />
                      </Link>
                    ) : (
                      <Avatar name={i.actor.name} uid={i.actor.uid} tone={i.actor.tone} size={28} className="shrink-0" />
                    )
                  ) : (
                    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sand text-[12px] font-bold text-body">
                      H
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug text-ink">{i.sentence}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-body">
                      <span className="font-grotesk tabular-nums">{formatStaffDate(i.at, log.tz, "time")}</span>
                      <span>· {AREA[i.area] ?? i.area}</span>
                      {i.sensitive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[12px] font-bold text-umber">
                          <Lock aria-hidden className="size-3" /> Sensitive
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {i.ref ? (
                    <Link href={adminHrefOfRef(i.ref)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 font-grotesk text-[13px] font-bold tabular-nums text-forest hover:bg-mint">
                      {i.ref} <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {log.nextCursor ? (
        <Link href={href({ area, only, who, cursor: log.nextCursor })} className="mx-auto inline-flex h-11 items-center rounded-full bg-white px-5 text-[14.5px] font-bold text-ink shadow-chip hover:bg-mint">
          Show older
        </Link>
      ) : null}
    </div>
  );
}
