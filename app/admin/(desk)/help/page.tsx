import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { guidesFor } from "@/content/admin-help";
import { requireStaff } from "@/lib/server/auth/session";

// Help (admin-ux §6.18): short guides for this person's roles, first-day first. Static content from
// content/admin-help.ts; every signed-in person may read it.

export const metadata: Metadata = { title: "Help" };

export default async function HelpPage() {
  const v = await requireStaff();
  const guides = guidesFor(v.roles);
  return (
    <>
      <PageHeader title="Help" description="Short guides for the things you do most. Start with your first day." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {guides.map((g, i) => (
          <li key={g.slug}>
            <Link href={`/admin/help/${g.slug}`} className="group flex h-full flex-col rounded-[26px] bg-white p-5 shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-card focus-forest">
              <EmptyState compact art={g.art} title={g.title} body={g.summary} headingLevel={2} className="py-4" />
              <span className="mt-auto inline-flex items-center justify-center gap-1.5 pt-2 text-[14px] font-bold text-forest">
                {i === 0 ? "Start here" : "Read the guide"} <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
