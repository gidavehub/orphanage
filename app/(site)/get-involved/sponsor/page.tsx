import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { PageHero } from "@/components/layout/PageHero";
import { ctaOf, eyebrowOf, itemsOf, paragraphsOf, titleOf } from "@/components/public/about/page-copy";
import { StepCards } from "@/components/public/help/StepCards";
import { SponsorGrid } from "@/components/public/involved/SponsorGrid";
import { Accordion } from "@/components/ui/Accordion";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getPage } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { getSponsorProfiles } from "@/lib/server/public/sponsors";

// /get-involved/sponsor (public-pages §3.19, PLAN D55): how sponsorship works, the privacy promise
// quoted from the spec, the published profiles (filters and `?ref=` handled client-side) and the
// questions. Profiles carry no photos, names, precise places or medical history.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("sponsor");
  return buildMetadata({
    title: page.seo.title ?? "Sponsor a Child",
    description: page.seo.description ?? page.hero.intro ?? "Sponsor a child's future through Haven's programmes.",
    path: routes.sponsor(),
    noindex: page.seo.noindex === true,
  });
}

export default async function SponsorPage() {
  const [page, profiles] = await Promise.all([getPage("sponsor"), getSponsorProfiles()]);
  const steps = itemsOf(page, "how");
  const promise = paragraphsOf(page, "privacy");
  const emptyText = paragraphsOf(page, "empty")[0] ?? "Every current profile is fully sponsored. Thank you!";
  const emptyCta = ctaOf(page, "empty", { label: "Give to the Fund", to: "donate" });
  const questions = itemsOf(page, "questions");

  return (
    <>
      <StudioSlot id="pages.sponsor">
        <PageHero
          variant="editorial"
          eyebrow={page.hero.eyebrow ?? "Sponsorship"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Involved", href: routes.involved() }, { label: "Sponsorship" }]}
          next="clay"
        />
      </StudioSlot>

      {steps.length ? (
        <Section tone="clay" pad="md" labelledBy="sponsor-how-title" cvSize={800}>
          <SectionIntro
            id="sponsor-how-title"
            light
            className="[&_.font-script]:text-marigold-100 [&_[data-eyebrow-rule]]:bg-marigold-100"
            eyebrow={eyebrowOf(page, "how", "How Sponsorship Works")}
            title={titleOf(page, "how", ["Four Simple Steps"])}
          />
          <StepCards items={steps} className="mt-12 md:mt-14" />
        </Section>
      ) : null}

      <Section tone="paper" pad="md" cv={false} labelledBy="sponsor-profiles-title">
        <div className="mx-auto flex max-w-[960px] gap-4 rounded-card-lg border-l-4 border-forest bg-white p-6 shadow-card md:gap-6 md:p-9">
          <ShieldCheck aria-hidden className="mt-1 size-8 shrink-0 text-forest" strokeWidth={2} />
          <div>
            <p className="font-script text-[26px] font-bold leading-none text-marigold-ink">{eyebrowOf(page, "privacy", "Our Privacy Promise")}</p>
            {promise.map((p, i) => (
              <p key={i} className={i === 0 ? "mt-4 text-[17px] leading-relaxed text-ink md:text-[19px]" : "mt-3 text-[16px] font-bold text-forest"}>
                {p}
              </p>
            ))}
          </div>
        </div>

        <h2 id="sponsor-profiles-title" className="mt-16 text-center font-display text-[40px] uppercase leading-none text-ink md:mt-20 md:text-[56px]">
          Children Waiting for a Sponsor
        </h2>
        <p className="mx-auto mt-4 max-w-[620px] text-center text-[16px] leading-relaxed text-body">
          Each profile is a real, assessed need in one of our programmes, shown with an anonymous reference only.
        </p>
        <div className="mt-10 md:mt-12">
          <SponsorGrid profiles={profiles} emptyText={emptyText} emptyCta={emptyCta} />
        </div>
      </Section>

      {questions.length ? (
        <Section tone="white" pad="md" width="reading" last labelledBy="sponsor-faq-title" cvSize={700}>
          <SectionIntro id="sponsor-faq-title" eyebrow={eyebrowOf(page, "questions", "Questions")} title={["Good to Know"]} />
          <Accordion
            className="mt-10"
            defaultOpen={["q0"]}
            items={questions.map((q, i) => ({ id: `q${i}`, title: q.title, content: <p className="text-[16px] leading-relaxed text-body">{q.text}</p> }))}
          />
        </Section>
      ) : null}
    </>
  );
}
