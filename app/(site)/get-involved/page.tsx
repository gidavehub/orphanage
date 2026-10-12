import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { PageHero, type PageHeroMedia } from "@/components/layout/PageHero";
import { FinalCta } from "@/components/public/home/FinalCta";
import { ctaOf, eyebrowOf, itemsOf, titleOf } from "@/components/public/help/page-copy";
import { Restoring } from "@/components/sections/Restoring";
import { Testimonials } from "@/components/sections/Testimonials";
import { Button } from "@/components/ui/Button";
import { ActionCard } from "@/components/ui/cards/ActionCard";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getHomeContent, getPage } from "@/lib/content/public";
import { img } from "@/lib/media/pipeline";
import { PARTNERSHIP_TYPES, VOLUNTEER_INTERESTS } from "@/lib/model/enums";
import { PARTNERSHIP_TYPE_LABEL, VOLUNTEER_INTEREST_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /get-involved (public-pages §3.16): the ways to help as a 2×2 card grid plus the wide Sponsorship
// card, the ten volunteer interests and the eight partnership types as deep links into their forms,
// the landing's Restoring film block, volunteer and partner voices, and the final call to action.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("getInvolved");
  const media = page.hero.media;
  return buildMetadata({
    title: page.seo.title ?? "Get Involved",
    description: page.seo.description ?? page.hero.intro ?? "Ways to help Haven.",
    path: routes.involved(),
    noindex: page.seo.noindex === true,
    image: media && media.type === "image" ? media.src : undefined,
  });
}

const WAYS = [
  { href: routes.donate(), image: "journey-give", tone: "forest" },
  { href: routes.donate(undefined, { mode: "in-kind" }), image: "appeal-education", tone: "charcoal" },
  { href: routes.volunteer(), image: "duo-volunteer", tone: "clay" },
  { href: routes.partner(), image: "duo-partner", tone: "charcoal" },
] as const;

const WAY_FALLBACK = [
  { title: "Donate", text: "Give once or every month to where it's needed most, or to a cause you care about." },
  { title: "Give in Kind", text: "School materials, clothing, bedding, food, medical supplies and more." },
  { title: "Become a Volunteer", text: "Contribute professional skills, time or community support." },
  { title: "Partner With Us", text: "Support programmes through partnerships, sponsorship or expertise." },
  { title: "Sponsorship", text: "Give monthly to cover a child's assessed needs through our programmes." },
];

const WAY_CTA = ["Donate Now", "Give in Kind", "Apply to Volunteer", "Partner With Us"];

export default async function GetInvolvedPage() {
  const [page, home] = await Promise.all([getPage("getInvolved"), getHomeContent()]);
  const media = page.hero.media;
  const heroMedia: PageHeroMedia =
    media && media.type === "image"
      ? { image: media }
      : media && media.type === "video"
        ? { video: media, illustrative: media.illustrative }
        : { image: { src: img("duo-volunteer"), alt: "", width: 1920, height: 1080 } };
  const ways = itemsOf(page, "ways", WAY_FALLBACK);
  const way = (i: number) => ({ title: ways[i]?.title ?? WAY_FALLBACK[i]!.title, text: ways[i]?.text ?? WAY_FALLBACK[i]!.text ?? "" });
  const sponsorship = way(4);
  const volunteerCta = ctaOf(page, "interests", { label: "Become a Volunteer", href: routes.volunteer() });
  const partnerCta = ctaOf(page, "partnershipTypes", { label: "Partner With Us", href: routes.partner() });
  // Volunteer and partner voices first (§3.16.6); donor and family words follow.
  const voices = [...home.testimonials.items].sort((a, b) => rank(a.kind) - rank(b.kind));

  return (
    <>
      <StudioSlot id="pages.getInvolved">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow ?? "Get Involved"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Involved" }]}
          media={heroMedia}
          next="white"
          baseUrl={baseUrl()}
        />
      </StudioSlot>

      <Section tone="white" pad="md" labelledBy="ways-title" cvSize={1400}>
        <SectionIntro id="ways-title" eyebrow={eyebrowOf(page, "ways", "Ways to Help")} title={titleOf(page, "ways", ["Choose How You Help"])} />
        <Reveal stagger={0.12} className="mt-12 grid gap-6 md:mt-14 md:grid-cols-2">
          {WAYS.map((w, i) => (
            <ActionCard
              key={w.href}
              title={way(i).title}
              text={way(i).text}
              cta={WAY_CTA[i]!}
              href={w.href}
              image={{ src: img(w.image), alt: "" }}
              tone={w.tone}
              brushRotate={i % 2 === 0 ? 20 : -14}
              headingLevel={3}
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          ))}
        </Reveal>
        <Reveal className="mt-6">
          <Link
            href={routes.sponsor()}
            className="group relative flex flex-col gap-6 overflow-hidden rounded-card-lg bg-coral-800 px-7 py-9 text-white shadow-card transition-transform duration-500 ease-out-expo hover:-translate-y-1 focus-forest sm:flex-row sm:items-center sm:justify-between md:px-12 md:py-12"
          >
            <span className="flex items-start gap-5">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15">
                <HeartHandshake className="size-7" strokeWidth={2} />
              </span>
              <span>
                <span className="block font-display text-[36px] uppercase leading-none md:text-[48px]">{sponsorship.title}</span>
                <span className="mt-3 block max-w-[560px] text-[16px] leading-relaxed text-white md:text-[17px]">{sponsorship.text}</span>
              </span>
            </span>
            <span className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-full bg-white px-7 text-[15px] font-bold text-coral-800 transition-colors group-hover:bg-cream">
              Meet the Profiles →
            </span>
          </Link>
        </Reveal>
      </Section>

      <Section tone="paper" pad="md" labelledBy="interests-title" cvSize={900}>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionIntro align="left" id="interests-title" eyebrow={eyebrowOf(page, "interests", "Volunteer")} title={titleOf(page, "interests", ["Where You Could Help"])} />
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {VOLUNTEER_INTERESTS.map((v) => (
                <li key={v}>
                  <Link href={routes.volunteer({ interest: v })} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-bold text-ink shadow-chip transition-colors hover:bg-forest hover:text-white focus-forest">
                    {VOLUNTEER_INTEREST_LABEL[v]}
                  </Link>
                </li>
              ))}
            </ul>
            <Button href={volunteerCta.href} variant="forest" className="mt-8">
              {volunteerCta.label}
            </Button>
          </div>
          <div>
            <SectionIntro align="left" id="partner-types-title" eyebrow={eyebrowOf(page, "partnershipTypes", "Partner")} title={titleOf(page, "partnershipTypes", ["Ways to Partner"])} />
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {PARTNERSHIP_TYPES.map((t) => (
                <li key={t}>
                  <Link href={routes.partner({ type: t })} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-bold text-ink shadow-chip transition-colors hover:bg-clay hover:text-white focus-forest">
                    {PARTNERSHIP_TYPE_LABEL[t]}
                  </Link>
                </li>
              ))}
            </ul>
            <Button href={partnerCta.href} variant="clay" className="mt-8">
              {partnerCta.label}
            </Button>
          </div>
        </div>
      </Section>

      <Restoring restoring={home.restoring} />

      {voices.length ? <Testimonials section={home.testimonials.section} testimonials={voices} /> : null}

      <FinalCta finalCta={home.finalCta} />
    </>
  );
}

function rank(kind: string): number {
  return kind === "volunteer" ? 0 : kind === "partner" ? 1 : 2;
}
