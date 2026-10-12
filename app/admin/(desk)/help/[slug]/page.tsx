import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { guideBySlug } from "@/content/admin-help";
import { requireStaff } from "@/lib/server/auth/session";

// One help guide (admin-ux §6.18): numbered steps, a tip, and a link to the place it's about.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: guideBySlug(slug)?.title ?? "Help" };
}

export default async function HelpGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const v = await requireStaff();
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g || (g.roles.length && !g.roles.some((r) => v.roles.includes(r)))) notFound();
  return (
    <>
      <PageHeader title={g.title} description={g.summary} back={{ label: "Help", href: "/admin/help" }} />
      <div className="max-w-[760px]">
        <ol className="grid gap-3">
          {g.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-[22px] bg-white p-5 shadow-soft">
              <span aria-hidden className="font-display text-[34px] leading-none text-marigold-ink">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-[17px] font-extrabold text-ink">{s.title}</span>
                <span className="mt-1 block text-[15px] leading-relaxed text-body">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        {g.tip ? (
          <p className="mt-5 flex gap-3 rounded-[22px] bg-marigold-100 p-5 text-[15px] leading-relaxed text-ink">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-umber" strokeWidth={2.25} />
            {g.tip}
          </p>
        ) : null}
        {g.place ? (
          <Link href={g.place.href} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-forest px-6 text-[15px] font-bold text-white transition-colors hover:bg-deep">
            Go to {g.place.label} <ArrowRight aria-hidden className="size-4" strokeWidth={2.5} />
          </Link>
        ) : null}
      </div>
    </>
  );
}
