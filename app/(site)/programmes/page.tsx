import type { Metadata } from "next";
import { HandsLineArt } from "@/components/art/Hands";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { ctaOf, eyebrowOf, heroMediaOf, paragraphsOf, titleOf } from "@/components/public/about/page-copy";
import { StepCards } from "@/components/public/help/StepCards";
import { FundCard, ProgrammeGrid } from "@/components/public/programmes/ProgrammeIndexParts";
import { Focus } from "@/components/sections/Focus";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getCauses, getHomeContent, getPage, getProgrammes } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /programmes (public-pages §3.3): the six programmes, the Focus chapter, how Haven decides who it
// helps, and a way to fund each programme through its `kind: 'programme'` cause (D40). Static: every
// read is a cached getter refreshed by its tag.

const FALLBACK_DECIDE = [
  "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support.",
  "Because of fraud, all information is checked and verified.",
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("programmes");
  return buildMetadata({
    title: page.seo.title ?? "Our Programmes",
    description: page.seo.description ?? page.hero.intro ?? "How Haven helps vulnerable children and families.",
    path: routes.programmes(),
    noindex: page.seo.noindex === true,
  });
}

export default async function ProgrammesPage() {
  const [page, programmes, causes, home] = await Promise.all([getPage("programmes"), getProgrammes(), getCauses({ kind: "programme" }), getHomeContent()]);
  const origin = baseUrl();
  const decide = paragraphsOf(page, "howWeDecide");
  const decideLines = decide.length ? decide : FALLBACK_DECIDE;
  const request = ctaOf(page, "grid", { label: "Request Support", to: "support" });
  const funds = programmes.flatMap((p) => {
    const cause = causes.find((c) => c.slug === p.causeSlug);
    return cause ? [{ programme: p, cause }] : [];
  });

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Haven programmes",
          itemListElement: programmes.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}${p.href}`, name: p.fullTitle })),
        }}
      />

      <StudioSlot id="pages.programmes">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          media={heroMediaOf(page.hero.media)}
          crumbs={[{ label: "Our Programmes" }]}
          baseUrl={origin}
        />
      </StudioSlot>

      <Section tone="paper" pad="none" cv={false} labelledBy="programme-grid-title" className="overflow-hidden pb-24 pt-16 md:pb-28 md:pt-20">
        <HandsLineArt className="absolute -left-16 top-10 hidden w-[330px] md:block xl:left-0 xl:w-[360px]" />
        <div className="relative">
          <SectionIntro
            id="programme-grid-title"
            eyebrow={eyebrowOf(page, "grid", "Our Programmes")}
            title={titleOf(page, "grid", ["We Do It For Every Child"])}
            intro="Six programmes, one aim: a safe, healthy and hopeful childhood. Choose one to see what we offer, who can ask and how it works."
          />
          <ProgrammeGrid programmes={programmes} />
          <Reveal className="mt-16 flex flex-wrap items-center justify-center gap-3">
            <Button href={request.href} variant="forest" size="lg" className="max-sm:w-full">
              {request.label}
            </Button>
            <Button href={routes.concern()} variant="outline" size="lg" icon="none" className="max-sm:w-full">
              Report a Concern
            </Button>
          </Reveal>
        </div>
      </Section>

      {/* The one cinematic beat on inner pages (public-pages §3.3.3), unchanged. */}
      <Focus focus={home.focus} />

      <Section tone="white" pad="md" labelledBy="decide-title" cvSize={1100}>
        <SectionIntro id="decide-title" eyebrow={eyebrowOf(page, "howWeDecide", "How We Decide Who We Help")} title={titleOf(page, "howWeDecide", ["Fair, Careful and Confidential"])} />
        <Notice tone="info" title="Please know" className="mx-auto mt-10 max-w-[860px]">
          {decideLines.map((l) => (
            <p key={l} className="[&+&]:mt-1.5">
              {l}
            </p>
          ))}
        </Notice>
        <StepCards surface="light" items={home.journey.steps.map((s) => ({ title: s.title, text: s.text }))} className="mt-12" />
      </Section>

      {funds.length ? (
        <Section tone="cream-2" pad="md" labelledBy="fund-title" cvSize={1200}>
          <SectionIntro
            id="fund-title"
            eyebrow={eyebrowOf(page, "fund", "Fund a Programme")}
            title={titleOf(page, "fund", ["Give to a Programme"])}
            intro="Choose the work closest to your heart. Every programme shows how gifts are planned to be spent."
          />
          <Reveal as="ul" stagger={0.08} y={30} className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {funds.map(({ programme, cause }) => (
              <li key={cause.slug}>
                <FundCard cause={cause} programme={programme} />
              </li>
            ))}
          </Reveal>
        </Section>
      ) : null}

      <CtaBand />
    </>
  );
}
