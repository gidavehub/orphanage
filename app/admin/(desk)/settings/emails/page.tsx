import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES, type EmailTemplateId } from "@/lib/model/email";
import { EMAIL_TEMPLATE_LABEL } from "@/lib/model/labels";
import { requireStaff } from "@/lib/server/auth/session";
import { getEmailCopy } from "@/lib/server/email/copy";

// Settings › Emails Haven sends (admin-ux §6.16; integrations §4.5): every email, grouped by what it's
// about, with "Your wording" where the team changed the words. Super admins.

export const metadata: Metadata = { title: "Emails Haven sends" };

const GROUPS: Array<{ title: string; match: (id: EmailTemplateId) => boolean }> = [
  { title: "Support and safeguarding", match: (id) => id.startsWith("support_") || id.startsWith("concern_") },
  { title: "Giving", match: (id) => /^(donation|recurring|refund|pledge|card_payment|donor_manage|inkind)/.test(id) },
  { title: "Counselling", match: (id) => id.startsWith("counselling_") || id.startsWith("zoom_") },
  { title: "Reports and resources", match: (id) => id.startsWith("report_") },
  { title: "Volunteers, partners and messages", match: (id) => /^(volunteer|partnership|contact|story|newsletter|supporter)/.test(id) },
  { title: "Privacy requests", match: (id) => id.startsWith("data_request") },
  { title: "To the team", match: (id) => id.startsWith("staff_") || id === "post_review_ready" || id === "email_test" },
];

export default function EmailsPage() {
  return (
    <>
      <PageHeader title="Emails Haven sends" description="Change the friendly words in any email. Subjects stay the same." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await requireStaff("settings.manage");
  const { copy } = await getEmailCopy();
  const sensitive = new Set<string>(SENSITIVE_EMAIL_TEMPLATES);
  return (
    <div className="grid gap-8">
      {GROUPS.map((g) => {
        const ids = EMAIL_TEMPLATE_IDS.filter(g.match);
        if (!ids.length) return null;
        return (
          <section key={g.title} aria-label={g.title}>
            <h2 className="mb-2 text-[16px] font-extrabold text-ink">{g.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-soft">
              {ids.map((id) => (
                <li key={id}>
                  <Link href={`/admin/settings/emails/${id}`} data-template={id} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-cream/60">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-ink">{EMAIL_TEMPLATE_LABEL[id]}</span>
                      {sensitive.has(id) ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-body">
                          <Lock aria-hidden className="size-3" /> Private: never says what it’s about
                        </span>
                      ) : null}
                    </span>
                    {copy[id] ? <span className="shrink-0 rounded-full bg-mint px-2.5 py-0.5 text-[12px] font-bold text-deep">Your wording</span> : null}
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-body" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
