import type { Metadata } from "next";
import { Building2, FlaskConical, HandCoins, Handshake, Lightbulb, Megaphone, Sparkles, Wrench } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FormAsideCard } from "@/components/layout/FormShell";
import { PageHero, type PageHeroMedia } from "@/components/layout/PageHero";
import { eyebrowOf, itemsOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { StepCards } from "@/components/public/help/StepCards";
import { PartnerForm } from "@/components/public/involved/PartnerForm";
import { Partners } from "@/components/sections/Partners";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getContact, getHomeContent, getPage, getProgrammes } from "@/lib/content/public";
import { img } from "@/lib/media/pipeline";
import { PARTNERSHIP_TYPES, type PartnershipType } from "@/lib/model/enums";
import { PARTNERSHIP_TYPE_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { PARTNERSHIP_TYPE_HELP } from "@/lib/schemas/forms/partnership";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";
import { enquireAboutPartnership } from "./actions";

// /get-involved/partner (public-pages §3.18): the eight ways to partner, the "we verify" hint for
// children's homes and charities, how partnership works, the partners strip and the enquiry form
// (HVN-PE reference + partnership_acknowledgement). `?type=` and `?programme=` prefill client-side.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("partner");
  const media = page.hero.media;
  return buildMetadata({
    title: page.seo.title ?? "Partner With Us",
    description: page.seo.description ?? page.hero.intro ?? "Partner with Haven.",
    path: routes.partner(),
    noindex: page.seo.noindex === true,
    image: media && media.type === "image" ? media.src : undefined,
  });
}

const TYPE_ICON: Record<PartnershipType, typeof Handshake> = {
  programme: Handshake,
  corporate_sponsorship: Building2,
  technical_assistance: Wrench,
  institutional_referral: Sparkles,
  research_collaboration: FlaskConical,
  donation_partnership: HandCoins,
  awareness_campaign: Megaphone,
  other: Lightbulb,
};

const HINT_FALLBACK =
  "Run an orphanage, children's home or charity and need support? Choose 'Institutional referral'. We'll arrange a verification call or visit.";

export default async function PartnerPage() {
  const [page, contact, programmes, home] = await Promise.all([getPage("partner"), getContact(), getProgrammes(), getHomeContent()]);
  const media = page.hero.media;
  const heroMedia: PageHeroMedia =
    media && media.type === "image"
      ? { image: media }
      : media && media.type === "video"
        ? { video: media, illustrative: media.illustrative }
        : { image: { src: img("duo-partner"), alt: "", width: 1920, height: 1080 } };
  // The studio's card copy, matched to the fixed types by position; the schema's lines fill any gap.
  const cards = itemsOf(page, "types");
  const types = PARTNERSHIP_TYPES.map((t, i) => ({ id: t, title: cards[i]?.title ?? PARTNERSHIP_TYPE_LABEL[t], text: cards[i]?.text ?? PARTNERSHIP_TYPE_HELP[t] }));
  const hint = textOf(page, "hint", HINT_FALLBACK);
  const process = itemsOf(page, "process", ["Enquiry", "Introductory call", "Due diligence", "Agreement", "Work together and report"].map((title) => ({ title })));
  const partnersEmail = contact.teamEmails.partnerships || contact.email;

  return (
    <>
      <StudioSlot id="pages.partner">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow ?? "Get Involved"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Involved", href: routes.involved() }, { label: "Partner" }]}
          media={heroMedia}
          next="paper"
          baseUrl={baseUrl()}
        />
      </StudioSlot>

      <Section tone="paper" pad="md" labelledBy="partner-types-title" cvSize={1100}>
        <SectionIntro id="partner-types-title" eyebrow={eyebrowOf(page, "types", "Partnership Types")} title={titleOf(page, "types", ["How We Can Work Together"])} />
        <Reveal as="ul" stagger={0.06} y={24} className="mt-12 grid gap-4 sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
          {types.map((t) => {
            const Icon = TYPE_ICON[t.id];
            return (
              <li key={t.id}>
                <a
                  href={`${routes.partner({ type: t.id })}#enquiry`}
                  className="group flex h-full flex-col rounded-card bg-white p-6 shadow-card transition-transform duration-300 ease-out-expo hover:-translate-y-1 focus-forest"
                >
                  <span aria-hidden className="grid size-12 place-items-center rounded-full bg-marigold/15 text-marigold-ink">
                    <Icon className="size-[22px]" strokeWidth={2.25} />
                  </span>
                  <span className="mt-5 text-[17px] font-extrabold leading-snug text-ink group-hover:text-forest">{t.title}</span>
                  <span className="mt-2 text-[15px] leading-relaxed text-body">{t.text}</span>
                </a>
              </li>
            );
          })}
        </Reveal>
        <div className="mx-auto mt-10 flex max-w-[860px] gap-4 rounded-card border-l-4 border-marigold bg-cream p-6 md:p-7">
          <Sparkles aria-hidden className="mt-0.5 size-6 shrink-0 text-marigold-ink" strokeWidth={2.25} />
          <p className="text-[16px] leading-relaxed text-ink">
            {hint}{" "}
            <a href={`${routes.partner({ type: "institutional_referral" })}#enquiry`} className="font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4">
              Start here
            </a>
          </p>
        </div>
      </Section>

      <Section tone="clay" pad="md" labelledBy="partner-process-title" cvSize={900}>
        <SectionIntro
          id="partner-process-title"
          light
          className="[&_.font-script]:text-marigold-100 [&_[data-eyebrow-rule]]:bg-marigold-100"
          eyebrow={eyebrowOf(page, "process", "How Partnership Works")}
          title={titleOf(page, "process", ["From First Call", "to Working Together"])}
        />
        <StepCards items={process} className="mt-12 md:mt-14" />
      </Section>

      {home.partners.logos.length ? (
        <div className="paper">
          <Partners partners={home.partners} />
        </div>
      ) : null}

      <Section tone="white" pad="md" cv={false} last label="Partnership enquiry">
        <div id="enquiry" className="grid scroll-mt-28 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-14 xl:gap-20">
          <div className="min-w-0 rounded-[30px] border border-line bg-white p-5 shadow-soft sm:p-8 md:p-10">
            <PartnerForm
              action={enquireAboutPartnership}
              programmes={programmes.map((p) => ({ id: p.id, slug: p.slug, title: p.title }))}
              contact={{ phone: contact.phone, email: contact.email }}
              responseTime={contact.responseTimes.contact}
              successTitle={titleOf(page, "success", ["Thank You"]).join(" ")}
              successMessage={textOf(page, "success", "Our partnerships team will be in touch.")}
              links={{ privacy: routes.policy("privacy"), home: routes.home, projects: routes.projects() }}
            />
          </div>
          <aside className="grid content-start gap-5 lg:sticky lg:top-28">
            <FormAsideCard title="We Verify Every Partner" tone="deep">
              <p>Before any agreement, we check who we are working with: registration, safeguarding policy and references. It keeps children safe and your support well placed.</p>
            </FormAsideCard>
            <FormAsideCard title="Prefer Email?" tone="white">
              <p>
                Write to our partnerships team at{" "}
                <a href={`mailto:${partnersEmail}`} className="break-all font-bold text-forest underline-offset-4 hover:underline">
                  {partnersEmail}
                </a>
                .
              </p>
            </FormAsideCard>
          </aside>
        </div>
      </Section>
    </>
  );
}
