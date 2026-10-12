import type { Metadata } from "next";
import Link from "next/link";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero, type PageHeroMedia } from "@/components/layout/PageHero";
import { ContactCards } from "@/components/public/help/ContactCards";
import { ContactForm } from "@/components/public/help/ContactForm";
import { HelpFaq } from "@/components/public/help/HelpFaq";
import { ctaOf, eyebrowOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getContact, getFaqs, getPage, getProgrammes } from "@/lib/content/public";
import { img } from "@/lib/media/pipeline";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";
import { submitContact } from "./actions";

// /contact (public-pages §3.8, PLAN D81, D104): offices, phone and email beside the message form.
// Child-protection reports are redirected to /report-a-concern before anything can be typed, and
// privacy requests to /privacy/request. Static; `?category=`, `?programme=`, `?subject=` prefill the
// form client-side.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("contact");
  const media = page.hero.media;
  return buildMetadata({
    title: page.seo.title ?? "Contact Us",
    description: page.seo.description ?? page.hero.intro ?? "Send Haven a message and our team will reply.",
    path: routes.contact(),
    noindex: page.seo.noindex === true,
    image: media && media.type === "image" ? media.src : undefined,
  });
}

export default async function ContactPage() {
  const [page, contact, allFaqs, programmes] = await Promise.all([getPage("contact"), getContact(), getFaqs(), getProgrammes()]);
  // The "about" group first (public-pages §3.8.5), topped up from the general questions to four.
  const faqs = [...allFaqs.filter((f) => f.placements.includes("about")), ...allFaqs.filter((f) => !f.placements.includes("about") && f.placements.includes("home"))].slice(0, 4);
  const media = page.hero.media;
  const heroMedia: PageHeroMedia =
    media && media.type === "image"
      ? { image: media }
      : media && media.type === "video"
        ? { video: media, illustrative: media.illustrative }
        : { image: { src: img("journey-orphanage"), alt: "", width: 1920, height: 1080 } };
  const concernText = textOf(page, "concernRedirect", "Worried about a child's safety? Please don't use this form. Our confidential concern form goes straight to our safeguarding team.");
  const concernCta = ctaOf(page, "concernRedirect", { label: "Report a Concern", href: routes.concern() });

  return (
    <>
      <StudioSlot id="pages.contact">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Contact" }]}
          media={heroMedia}
          next="white"
          baseUrl={baseUrl()}
        />
      </StudioSlot>

      <Section tone="white" pad="md" cv={false} label="Contact Haven">
        <Notice tone="emergency" compact title="Worried about a child's safety?" titleAs="h2" action={
          <Button href={concernCta.href} variant="marigold-ink" size="sm" icon="arrow-right">
            {concernCta.label}
          </Button>
        }>
          <p>{concernText.replace(/^Worried about a child's safety\?\s*/i, "")}</p>
        </Notice>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
          <div className="order-2 lg:order-1">
            <ContactCards contact={contact} />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <div className="rounded-[30px] border border-line bg-white p-5 shadow-soft sm:p-8 md:p-10">
              <ContactForm
                action={submitContact}
                programmes={programmes.map((p) => ({ slug: p.slug, title: p.title }))}
                contact={{ phone: contact.phone, email: contact.email }}
                responseTime={contact.responseTimes.contact}
                concernText={concernText}
              />
            </div>
          </div>
        </div>
      </Section>

      {faqs.length ? (
        <Section tone="paper" pad="md" width="reading" labelledBy="contact-faq-title" cvSize={900}>
          <SectionIntro id="contact-faq-title" eyebrow={eyebrowOf(page, "questions", "Questions")} title={titleOf(page, "questions", ["Common Questions"])} />
          <HelpFaq faqs={faqs} className="mt-10" />
          <p className="mt-8 text-center text-[15px] text-body">
            More answers on our{" "}
            <Link href={routes.faq()} className="font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
              questions page
            </Link>
            .
          </p>
        </Section>
      ) : null}

      <CtaBand />
    </>
  );
}
