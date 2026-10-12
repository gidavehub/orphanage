import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FormAsideCard } from "@/components/layout/FormShell";
import { PageHero, type PageHeroMedia } from "@/components/layout/PageHero";
import { ctaOf, eyebrowOf, itemsOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { StepCards } from "@/components/public/help/StepCards";
import { VolunteerForm } from "@/components/public/involved/VolunteerForm";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getContact, getPage } from "@/lib/content/public";
import { img } from "@/lib/media/pipeline";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";
import { applyToVolunteer } from "./actions";

// /get-involved/volunteer (public-pages §3.17): what to expect, the safeguarding commitment and the
// three-step application (HVN-VA reference + volunteer_acknowledgement). `?interest=` preselects
// interests client-side, so the page stays static.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("volunteer");
  const media = page.hero.media;
  return buildMetadata({
    title: page.seo.title ?? "Become a Volunteer",
    description: page.seo.description ?? page.hero.intro ?? "Volunteer with Haven.",
    path: routes.volunteer(),
    noindex: page.seo.noindex === true,
    image: media && media.type === "image" ? media.src : undefined,
  });
}

export default async function VolunteerPage() {
  const [page, contact] = await Promise.all([getPage("volunteer"), getContact()]);
  const media = page.hero.media;
  const heroMedia: PageHeroMedia =
    media && media.type === "image"
      ? { image: media }
      : media && media.type === "video"
        ? { video: media, illustrative: media.illustrative }
        : { image: { src: img("duo-volunteer"), alt: "", width: 1920, height: 1080 } };
  const steps = itemsOf(page, "expect", ["Apply", "Screening", "Interview", "Approval", "Onboarding", "Active"].map((title) => ({ title })));
  const safeguarding = textOf(page, "safeguarding", "Volunteers who work with children complete safeguarding training and background checks before they begin.");
  const under18 = textOf(page, "under18", "Thank you! Volunteering is for adults, but you can still help.");
  const under18Cta = ctaOf(page, "under18", { label: "Ways to Help", href: routes.involved() });

  return (
    <>
      <StudioSlot id="pages.volunteer">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow ?? "Get Involved"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Involved", href: routes.involved() }, { label: "Volunteer" }]}
          media={heroMedia}
          next="clay"
          baseUrl={baseUrl()}
        />
      </StudioSlot>

      <Section tone="clay" pad="md" labelledBy="vol-expect-title" cvSize={900}>
        <SectionIntro
          id="vol-expect-title"
          light
          className="[&_.font-script]:text-marigold-100 [&_[data-eyebrow-rule]]:bg-marigold-100"
          eyebrow={eyebrowOf(page, "expect", "What to Expect")}
          title={titleOf(page, "expect", ["From Application", "to Your First Day"])}
        />
        <StepCards items={steps} className="mt-12 md:mt-14" />
      </Section>

      <Section tone="white" pad="md" cv={false} last label="Volunteer application">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-14 xl:gap-20">
          <div className="min-w-0 rounded-[30px] border border-line bg-white p-5 shadow-soft sm:p-8 md:p-10">
            <VolunteerForm
              action={applyToVolunteer}
              contact={{ phone: contact.phone, email: contact.email }}
              responseTime={contact.responseTimes.volunteer}
              copy={{
                under18,
                under18Cta,
                safeguarding,
                successTitle: titleOf(page, "success", ["Thank You for Offering", "Your Time!"]).join(" "),
                next: steps.slice(1, 4).map((s) => ({ title: s.title, body: s.text })),
              }}
              links={{
                privacy: routes.policy("privacy"),
                safeguarding: routes.policy("safeguarding"),
                involved: routes.involved(),
                home: routes.home,
                stories: routes.stories(),
              }}
            />
          </div>
          <aside className="grid content-start gap-5 lg:sticky lg:top-28">
            <FormAsideCard title="Our Safeguarding Commitment" tone="deep">
              <p className="flex gap-3">
                <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-marigold" strokeWidth={2.25} />
                <span>{safeguarding}</span>
              </p>
            </FormAsideCard>
            <FormAsideCard title="Good to Know" tone="white">
              <ul className="grid gap-3 text-[15px] leading-relaxed">
                <li>No CV needed now. We ask for it at screening.</li>
                <li>We reply within {contact.responseTimes.volunteer}.</li>
                <li>
                  Questions? Email{" "}
                  <a href={`mailto:${contact.email}`} className="break-all font-bold text-forest underline-offset-4 hover:underline">
                    {contact.email}
                  </a>
                  .
                </li>
              </ul>
            </FormAsideCard>
          </aside>
        </div>
      </Section>
    </>
  );
}
