import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, UserRoundCheck } from "lucide-react";
import { Blocks, blockToc } from "@/components/content/Blocks";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { PolicyShell } from "@/components/layout/PolicyShell";
import { textOf } from "@/components/public/about/page-copy";
import { PlainWords } from "@/components/public/policies/PlainWords";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { getContact, getPage, getPolicy, getSafety } from "@/lib/content/public";
import { POLICY_SLUGS, type PolicySlug } from "@/lib/content/schema";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /policies/[slug] (public-pages §3.21; PLAN D44, D50): safeguarding, privacy and terms. The plain
// hero carries the review facts and the "Draft, pending professional review" banner while no
// professional review is recorded; then "In plain words", a sticky contents list built from the
// policy's heading blocks, the body and a closing contact card.
//
// `instant = false` (route segment config, not a D5-forbidden export): params are read at the top so
// an unknown slug answers a real HTTP 404 instead of a streamed 200; all three slugs are prerendered.
export const instant = false;

export function generateStaticParams(): Array<{ slug: PolicySlug }> {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

const isPolicySlug = (s: string): s is PolicySlug => (POLICY_SLUGS as readonly string[]).includes(s);

function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const policy = isPolicySlug(slug) ? await getPolicy(slug) : null;
  if (!policy) return { title: "Policy not found" };
  return buildMetadata({
    title: policy.seo.title ?? policy.title,
    description: policy.seo.description ?? policy.summary.join(" "),
    path: policy.href,
    noindex: policy.seo.noindex === true,
  });
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  if (!isPolicySlug(slug)) notFound();
  const [policy, page, contact, safety] = await Promise.all([getPolicy(slug), getPage("policies"), getContact(), getSafety()]);
  if (!policy) notFound();

  const toc = blockToc(policy.body);
  const mailbox = slug === "safeguarding" ? contact.teamEmails.safeguarding : slug === "privacy" ? contact.teamEmails.privacy : contact.email;
  const draftText = textOf(page, "draftBanner", "Draft, pending professional review.");
  const reviewedBy = policy.lastReview?.by;

  return (
    <>
      <PageHero
        variant="plain"
        art={slug === "safeguarding" ? "hands" : "hearts"}
        eyebrow="Our Policies"
        title={policy.title}
        crumbs={[{ label: "Policies", href: routes.policies() }, { label: policy.title }]}
        meta={
          <>
            <span>Effective from {longDate(policy.effectiveFrom)}</span>
            {reviewedBy ? <span>Reviewed by {reviewedBy}</span> : null}
          </>
        }
        notice={
          policy.draft ? (
            <Notice tone="info" title={draftText}>
              This text is a working draft. It will be checked by a qualified professional before it is final, and this note will then disappear.
            </Notice>
          ) : undefined
        }
        actions={
          policy.pdfHref ? (
            <Button href={policy.pdfHref} variant="outline" icon="none" iconFirst prefetch={false}>
              <Download aria-hidden className="size-4" strokeWidth={2.5} />
              Download PDF
            </Button>
          ) : undefined
        }
        baseUrl={baseUrl()}
      />

      <Section tone="white" pad="md" cv={false} last={slug !== "safeguarding"} label={policy.title}>
        <PolicyShell
          toc={toc}
          meta={{ reviewed: policy.lastReviewedLabel ?? longDate(policy.effectiveFrom), version: policy.version, ...(policy.pdfHref ? { pdf: policy.pdfHref } : {}) }}
          notice={
            <div className="grid gap-5">
              <PlainWords points={policy.summary} />
              {slug === "privacy" ? (
                <div className="flex flex-col items-start gap-4 rounded-card border-2 border-forest/15 bg-mint/50 p-6 sm:flex-row sm:items-center md:p-7">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-forest text-white">
                    <UserRoundCheck aria-hidden className="size-6" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-extrabold leading-snug text-ink">See, correct or delete your information</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-body">Send a privacy request and we&apos;ll reply within 30 days.</p>
                  </div>
                  <Button href={routes.privacyRequest()} variant="forest" size="sm" icon="arrow-right">
                    Make a request
                  </Button>
                </div>
              ) : null}
            </div>
          }
          contact={{
            text: "Questions about this policy?",
            label: `Email ${mailbox}`,
            href: `mailto:${mailbox}`,
          }}
        >
          <Blocks blocks={policy.body} prose={false} />
        </PolicyShell>
      </Section>

      {slug === "safeguarding" ? <CtaBand variant="safeguarding" emergencyNotice={safety.emergencyNotice} /> : null}
    </>
  );
}
