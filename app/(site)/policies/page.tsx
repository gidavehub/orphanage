import type { Metadata } from "next";
import { BookOpenCheck, UserRoundCog } from "lucide-react";
import { CtaBand } from "@/components/layout/CtaBand";
import { Blocks } from "@/components/content/Blocks";
import { PageHero } from "@/components/layout/PageHero";
import { PolicyCard } from "@/components/public/policies/PolicyCard";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { IconDisc } from "@/components/ui/IconDisc";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { getPage, getPolicies } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /policies (public-pages §3.21): the Child Safeguarding Policy, Privacy Policy and Terms of Use as
// cards, plus the way to the partner-institution policies in the resources library and to a
// privacy request. Static; refreshed by the policies and pages.policies tags.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("policies");
  return buildMetadata({
    title: page.seo.title ?? "Policies",
    description: page.seo.description ?? "Haven's Child Safeguarding Policy, Privacy Policy and Terms of Use.",
    path: routes.policies(),
  });
}

export default async function PoliciesPage() {
  const [page, policies] = await Promise.all([getPage("policies"), getPolicies()]);
  const partnerBody = page.sections.partnerPolicies?.body ?? [];

  return (
    <>
      <PageHero variant="plain" art="hands" eyebrow={page.hero.eyebrow} title={page.hero.title} intro={page.hero.intro} crumbs={[{ label: "Policies" }]} baseUrl={baseUrl()} />

      <Section tone="paper" pad="md" label="Our policies">
        <Reveal stagger={0.1} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((p) => (
            <PolicyCard key={p.slug} policy={p} />
          ))}
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="flex items-start gap-5 rounded-card bg-cream p-6 md:p-7">
            <IconDisc icon={BookOpenCheck} size={52} halo="none" />
            <div className="min-w-0">
              <h2 className="text-[19px] font-extrabold leading-snug text-ink">Policies for partner institutions</h2>
              <div className="mt-2 text-[15px] leading-relaxed text-body [&_a]:font-bold [&_a]:text-forest [&_a]:underline [&_a]:decoration-marigold [&_a]:decoration-2 [&_a]:underline-offset-4">
                {partnerBody.length ? <Blocks blocks={partnerBody} prose={false} /> : <p>Schools, clinics and children&apos;s homes can use our model policies and guidance.</p>}
              </div>
              <ArrowLink href={routes.resources({ category: "organisational_policies" })} className="mt-3 font-bold">
                Browse the resources library
              </ArrowLink>
            </div>
          </div>
          <div className="flex items-start gap-5 rounded-card bg-mint p-6 md:p-7">
            <IconDisc icon={UserRoundCog} size={52} halo="none" />
            <div className="min-w-0">
              <h2 className="text-[19px] font-extrabold leading-snug text-ink">Your information, your choice</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-body">
                Ask us to show you, correct or delete what we hold about you, or to stop contacting you. We reply within 30 days.
              </p>
              <ArrowLink href={routes.privacyRequest()} className="mt-3 font-bold">
                Make a privacy request
              </ArrowLink>
            </div>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
