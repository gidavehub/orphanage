import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ExportLinks } from "@/components/admin/ui/ExportLinks";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { newsletterStats } from "@/lib/server/dal/posts";

// Settings › Newsletter (PLAN D103, D129): who gets supporter updates. Double opt-in: only confirmed
// subscribers (and donors who asked for updates) receive them; unsubscribes are honoured at send time.

export const metadata: Metadata = { title: "Newsletter" };

const SOURCE: Record<string, string> = { footer: "Website footer", join_section: "Join section", donation: "When giving", volunteer: "Volunteer form", post: "A post", admin_import: "Added by the team" };

export default function NewsletterPage() {
  return (
    <>
      <PageHeader title="Newsletter" description="Who gets supporter updates." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Stats />
      </Suspense>
    </>
  );
}

async function Stats() {
  const v = await requireStaff("newsletter.read", "settings.manage");
  const s = await newsletterStats();
  const tiles = [
    ["Confirmed", s.confirmed, "They get updates."],
    ["Waiting to confirm", s.pending, "They haven’t clicked the link yet, so they get nothing."],
    ["Unsubscribed", s.unsubscribed, "We never email them updates again."],
    ["Donors who asked for updates", s.consentedDonors, "Added to each send, once per address."],
  ] as const;
  return (
    <div className="grid gap-5">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([label, n, hint]) => (
          <li key={label} className="rounded-[22px] bg-white p-5 shadow-soft">
            <p className="text-[13.5px] font-bold text-body">{label}</p>
            <p className="mt-1 font-grotesk text-[32px] font-semibold tabular-nums text-ink">{n}</p>
            <p className="text-[13px] text-body">{hint}</p>
          </li>
        ))}
      </ul>
      <section className="rounded-[22px] bg-white p-5 shadow-soft">
        <h2 className="mb-3 text-[17px] font-extrabold text-ink">Where confirmed subscribers signed up</h2>
        <ul className="grid gap-1.5 text-[14.5px]">
          {Object.entries(s.bySource).map(([k, n]) => (
            <li key={k} className="flex justify-between border-b border-line pb-1.5 last:border-0">
              <span className="text-ink">{SOURCE[k] ?? k}</span>
              <span className="font-grotesk font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
        {has(v, "newsletter.export") ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ExportLinks dataset="newsletter" label="Subscribers" withContacts />
            <p className="text-[13.5px] text-body">Each download is logged.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
