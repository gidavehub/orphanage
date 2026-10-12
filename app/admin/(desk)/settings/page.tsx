import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Database, HandCoins, Mail, MailPen, Newspaper, PlugZap } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { AREA_PERMS } from "@/lib/admin/access";
import { hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { features } from "@/lib/server/env";
import { integrationStatuses } from "@/lib/server/integrations/status";

// Settings (admin-ux §6.16): a short list of cards, only the ones this person can open. No toggles
// wall: each card says in one line what lives there.

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="How Haven is connected, what it sends, and how long it keeps things." />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Cards />
      </Suspense>
    </>
  );
}

async function Cards() {
  const v = await requireStaff(...AREA_PERMS.settings.read);
  const off = integrationStatuses().filter((s) => s.state !== "connected").length;
  const cards = [
    hasAny(v, "settings.giving", "settings.manage") && { href: "/admin/settings/giving", icon: HandCoins, title: "Giving", line: "How people pay, bank and mobile-money details, receipts and thank-yous." },
    hasAny(v, "newsletter.read", "settings.manage") && { href: "/admin/settings/newsletter", icon: Newspaper, title: "Newsletter", line: "Who gets Haven's updates, and what was sent." },
    hasAny(v, "settings.manage") && { href: "/admin/settings/connections", icon: PlugZap, title: "Connections", line: off ? `${off} not connected yet. See what each one means.` : "Everything is connected." },
    (hasAny(v, "settings.manage") || features.practiceMode) && {
      href: "/admin/settings/email-log",
      icon: Mail,
      title: hasAny(v, "settings.manage") ? "Email log" : "Your emails",
      line: features.practiceMode ? "Practice mode: every email waits here instead of being sent." : "Every email Haven sent, and whether it arrived.",
    },
    hasAny(v, "settings.manage") && { href: "/admin/settings/emails", icon: MailPen, title: "Emails Haven sends", line: "Change the friendly words in any email. Subjects stay the same." },
    hasAny(v, "privacy.manage") && { href: "/admin/settings/data", icon: Database, title: "Data & privacy", line: "Privacy requests, how long records are kept, and backups." },
  ].filter((c): c is { href: string; icon: typeof Mail; title: string; line: string } => Boolean(c));

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {cards.map((c) => (
        <li key={c.href}>
          <Link href={c.href} className="group flex min-h-24 items-center gap-4 rounded-[22px] bg-white p-5 shadow-soft transition-shadow hover:shadow-card">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mint text-forest">
              <c.icon aria-hidden className="size-6" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-extrabold text-ink">{c.title}</span>
              <span className="mt-0.5 block text-[14.5px] leading-snug text-body">{c.line}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-body transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
