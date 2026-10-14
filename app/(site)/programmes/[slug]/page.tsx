import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Blocks } from "@/components/content/Blocks";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { heroMediaOf } from "@/components/public/about/page-copy";
import { FaqList } from "@/components/public/faq/FaqAnswer";
import { StepCards } from "@/components/public/help/StepCards";
import { GiftPath } from "@/components/public/programmes/GiftPath";
import { EligibilityLists, ProgrammeContact, ProgrammeNotices, ProgrammeOverview, SupportTiles } from "@/components/public/programmes/ProgrammeParts";
import { SectionChips, type SectionChip } from "@/components/public/programmes/SectionChips";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Button } from "@/components/ui/Button";
import { ActionCard } from "@/components/ui/cards/ActionCard";
import { ResourceCard } from "@/components/ui/cards/ResourceCard";
import { StoryCard } from "@/components/ui/cards/StoryCard";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { VuHeading } from "@/components/ui/SectionHeading";
import { getCause, getContact, getContent, getFaqs, getProgramme, getResources, getSafety, getSiteSettings, getStats, getStories } from "@/lib/content/public";
import type { ResolvedImage, ResolvedMedia, ResolvedProgramme, StoryView } from "@/lib/content/types";
import { countryByCode } from "@/content/world";
import { PROGRAMME_SLUGS, type ProgrammeSlug } from "@/lib/model/enums";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import type { ResourceSummary } from "@/lib/model/dto";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /programmes/[slug] (public-pages §3.4; content-model §8; PLAN D5, D40, D41): one template, six pages,
// in the ToR §5 order: hero, notices, sticky chips, overview, the problem, support, eligibility,
// process, request / give / partner, where a gift goes, resources, stories, FAQs, programme contact.
//
// `instant = false` (route segment config, not a D5-forbidden export): params are read at the top so
// a slug outside the six answers a real HTTP 404 instead of a streamed 200 (as the policy and cause
// pages do). All six slugs are prerendered by generateStaticParams; every read is a cached getter.
export const instant = false;

export function generateStaticParams(): Array<{ slug: ProgrammeSlug }> {
  return PROGRAMME_SLUGS.map((slug) => ({ slug }));
}

const isProgrammeSlug = (s: string): s is ProgrammeSlug => (PROGRAMME_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({ params }: PageProps<"/programmes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const programme = isProgrammeSlug(slug) ? await getProgramme(slug) : null;
  if (!programme) return { title: "Programme not found" };
  return buildMetadata({
    title: programme.seo.title ?? programme.fullTitle,
    description: programme.seo.description ?? programme.summary,
    path: programme.href,
    noindex: programme.seo.noindex === true,
  });
}

function asImage(m: ResolvedMedia): ResolvedImage | null {
  if (m.type === "image") return m;
  if (m.type === "video")
    return {
      type: "image",
      assetId: m.assetId,
      src: m.poster,
      alt: m.alt,
      illustrative: m.illustrative,
    };
  return null;
}

function dateLabel(ms: number, timeZone: string): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

function fileSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** Related stories: the programme's chosen ones first, then others about it, at most three. */
function pickStories(p: ResolvedProgramme, all: StoryView[]): StoryView[] {
  const chosen = p.relatedStoryIds.map((id) => all.find((s) => s.id === id)).filter((s): s is StoryView => !!s);
  const more = all.filter((s) => s.programmeId === p.id && !chosen.includes(s));
  return [...chosen, ...more].slice(0, 3);
}

/** Related resources: chosen ids, then its categories, then anything tagged with the programme. */
function pickResources(p: ResolvedProgramme, pools: ResourceSummary[][]): ResourceSummary[] {
  const all = pools.flat();
  const seen = new Set<string>();
  const out: ResourceSummary[] = [];
  const add = (r: ResourceSummary | undefined) => {
    if (!r || seen.has(r.slug)) return;
    seen.add(r.slug);
    out.push(r);
  };
  p.relatedResourceIds.forEach((id) => add(all.find((r) => r.id === id || r.slug === id)));
  all.filter((r) => p.resourceCategories.includes(r.category)).forEach(add);
  all.filter((r) => r.programmeIds.includes(p.id)).forEach(add);
  return out.slice(0, 3);
}

export default async function ProgrammePage({ params }: PageProps<"/programmes/[slug]">) {
  const { slug } = await params;
  if (!isProgrammeSlug(slug)) notFound();
  const programme = await getProgramme(slug);
  if (!programme) notFound();

  const causeSlug = programme.donateCta.causeSlug ?? programme.causeSlug;
  const [safety, cause, faqs, stories, contact, site, stats, duo, ...resourcePools] = await Promise.all([
    getSafety(),
    getCause(causeSlug),
    getFaqs({ ids: programme.faqIds }),
    getStories(),
    getContact(),
    getSiteSettings(),
    getStats(),
    getContent("home.duo"),
    getResources({}),
    ...programme.resourceCategories.map((category) => getResources({ category })),
  ]);
  const pools = resourcePools.map((r) => r.items);
  const resources = pickResources(programme, pools);
  const related = pickStories(programme, stories);
  const origin = baseUrl();

  const protection = programme.id === "protection";
  const requestHref = routes.request(programme.requestCta.category);
  const giveHref = cause?.href ?? programme.donateHref;
  const askHref = routes.contact({
    category: "programme_info",
    programme: programme.slug,
  });
  const facts = programme.problem.facts.flatMap((f) => {
    const stat = f.statId ? stats[f.statId] : undefined;
    return stat && stat.verified
      ? [
          {
            value: `${stat.value.toLocaleString("en")}${stat.suffix}`,
            label: f.label,
            source: f.source,
          },
        ]
      : [];
  });
  const overviewImage = asImage(programme.image) ?? asImage(programme.hero.media);
  const duoImages = duo.cards.map((c) => asImage(c.image)).filter((i): i is ResolvedImage => !!i);
  const phone = programme.contact.phone ?? contact.phone;

  const chips: SectionChip[] = [
    { id: "overview", label: "Overview" },
    { id: "problem", label: "The Problem" },
    { id: "support", label: "Support" },
    { id: "eligibility", label: "Eligibility" },
    { id: "process", label: "How It Works" },
    ...(resources.length ? [{ id: "resources", label: "Resources" }] : []),
    { id: "contact", label: "Contact" },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${origin}${programme.href}#service`,
          name: programme.fullTitle,
          description: programme.summary,
          url: `${origin}${programme.href}`,
          serviceType: programme.title,
          provider: { "@id": `${origin}/#org` },
          audience: {
            "@type": "Audience",
            audienceType: "Vulnerable children and their families",
          },
        }}
      />

      <PageHero
        variant="programme"
        programme={programme.id}
        eyebrow={programme.fullTitle}
        title={programme.headline}
        intro={programme.summary}
        media={heroMediaOf(programme.hero.media)}
        crumbs={[{ label: "Our Programmes", href: routes.programmes() }, { label: programme.title }]}
        next="white"
        baseUrl={origin}
        actions={
          protection ? (
            <>
              <Button href={routes.concern()} variant="vu" size="lg" icon="none" className="max-sm:w-full">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert aria-hidden className="size-[18px]" strokeWidth={2.25} /> Report a Concern
                </span>
              </Button>
              <Button href={requestHref} variant="outline-light" size="lg" icon="none" className="max-sm:w-full">
                Request Support
              </Button>
            </>
          ) : (
            <>
              <Button href={requestHref} variant="marigold-ink" size="lg" className="max-sm:w-full">
                Request Support
              </Button>
              <Button href={giveHref} variant="outline-light" size="lg" icon="heart" className="max-sm:w-full">
                Support This Programme
              </Button>
            </>
          )
        }
      />

      <ProgrammeNotices
        notices={programme.notices}
        emergency={{
          text: safety.emergencyNotice,
          contacts: safety.emergencyContacts,
        }}
        everyChild={site.everyChild}
      />

      <div className="relative">
        <SectionChips items={chips} label={`${programme.title}: on this page`} />

        {overviewImage ? (
          <ProgrammeOverview
            title={["Our Work in", programme.title]}
            image={overviewImage}
            actions={{
              primary: protection ? { label: "Report a Concern", href: routes.concern() } : { label: programme.requestCta.label, href: requestHref },
              secondary: { label: programme.donateCta.label, href: giveHref },
            }}
          >
            <Blocks blocks={programme.overview} prose={false} measure={false} idPrefix="overview-" />
          </ProgrammeOverview>
        ) : null}

        {/* The page's one Voices United chapter (D121). */}
        <Section id="problem" tone="vu-cream" pad="md" cv={false} labelledBy="problem-title">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <p className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/75">{programme.problem.heading}</p>
              <VuHeading id="problem-title" parts={["The", "Problem"]} accentClass="text-coral-800" className="mt-3 text-ink" />
            </Reveal>
            <Reveal y={30} delay={0.1} className="font-grotesk text-[17px] leading-[1.75] text-ink/85 lg:pt-8 [&_p+p]:mt-5">
              <Blocks blocks={programme.problem.body} prose={false} measure={false} idPrefix="problem-" />
              {facts.length ? (
                <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                  {facts.map((f) => (
                    <div key={f.label} className="rounded-card bg-white p-5">
                      <dt className="text-[15px] font-semibold text-ink">{f.label}</dt>
                      <dd className="mt-1 font-display text-[40px] leading-none text-coral-800">{f.value}</dd>
                      <dd className="mt-2 text-[13px] text-body">Source: {f.source}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Reveal>
          </div>
        </Section>

        <Section id="support" tone="paper" pad="md" cv={false} labelledBy="support-title">
          <SectionIntro id="support-title" eyebrow="What We Offer" title={[programme.support.heading]} intro={programme.support.intro} />
          <SupportTiles items={programme.support.items} className="mt-12 md:mt-14" />
        </Section>

        <Section id="eligibility" tone="white" pad="md" cv={false} labelledBy="eligibility-title">
          <SectionIntro id="eligibility-title" eyebrow="Eligibility" title={[programme.eligibility.heading]} intro={programme.eligibility.intro} />
          <div className="mt-12">
            <EligibilityLists
              who={programme.eligibility.criteria.who}
              whatWeAsk={programme.eligibility.criteria.whatWeAsk}
              note={programme.eligibility.note}
              ask={{ href: askHref }}
            />
          </div>
        </Section>

        <Section id="process" tone="clay" pad="md" cv={false} labelledBy="process-title">
          {/* The brand marigold script is 2.5:1 on clay: the soft marigold keeps the eyebrow AA (as on Get Support). */}
          <SectionIntro
            id="process-title"
            light
            className="[&_.font-script]:text-marigold-100 [&_[data-eyebrow-rule]]:bg-marigold-100"
            eyebrow="Step by Step"
            title={[programme.process.heading]}
          />
          <StepCards items={programme.process.steps} className="mt-12 md:mt-14" />
        </Section>

        {duoImages.length >= 2 ? (
          <Section tone="white" pad="md" cv={false} label="Ask for help, give or partner">
            <Reveal stagger={0.12} y={40} className="grid gap-5 lg:grid-cols-3">
              <ActionCard
                tone="forest"
                title="Need This Support?"
                text={programme.requestCta.text}
                cta={protection ? "Report a Concern" : "Request Support"}
                href={protection ? routes.concern() : requestHref}
                image={overviewImage ?? duoImages[0]}
                headingLevel={2}
                sizes="(min-width:1024px) 33vw, 100vw"
              />
              <ActionCard
                tone="charcoal"
                title={`Give to ${programme.title}`}
                text={programme.donateCta.text}
                cta="Give Now"
                href={giveHref}
                image={duoImages[0]}
                brushRotate={-14}
                headingLevel={2}
                sizes="(min-width:1024px) 33vw, 100vw"
              />
              <ActionCard
                tone="clay"
                title={programme.partnerCta.label}
                text={programme.partnerCta.text}
                cta="Partner With Us"
                href={programme.partnerHref}
                image={duoImages[1]}
                headingLevel={2}
                sizes="(min-width:1024px) 33vw, 100vw"
              />
            </Reveal>
          </Section>
        ) : null}

        {cause ? (
          <Section tone="cream-2" pad="md" cv={false} labelledBy="gift-title">
            <GiftPath cause={cause} programmeTitle={programme.title} />
          </Section>
        ) : null}

        {resources.length ? (
          <Section id="resources" tone="paper" pad="md" cv={false} labelledBy="resources-title">
            <SectionIntro
              id="resources-title"
              eyebrow="Resources"
              title={["Guides and Reports"]}
              actions={
                <ArrowLink
                  href={routes.resources({
                    category: programme.resourceCategories[0],
                  })}
                  className="font-bold"
                >
                  See all resources
                </ArrowLink>
              }
            />
            <Reveal as="ul" stagger={0.1} y={30} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((r) => {
                const isPublic = r.access === "public";
                return (
                  <li key={r.slug}>
                    <ResourceCard
                      title={r.title}
                      {...(r.cover ? { cover: r.cover } : {})}
                      date={dateLabel(r.publicationDate, site.timeZone)}
                      category={RESOURCE_CATEGORY_LABEL[r.category]}
                      summary={r.shortDescription}
                      access={isPublic ? "public" : "request"}
                      {...(r.file
                        ? {
                            file: {
                              size: fileSize(r.file.sizeBytes),
                              type: "PDF",
                            },
                          }
                        : {})}
                      href={routes.resource(r.slug)}
                      {...(isPublic && r.file ? { downloadHref: routes.resourceDownload(r.slug) } : {})}
                      {...(!isPublic ? { requestHref: routes.requestReport(r.slug) } : {})}
                    />
                  </li>
                );
              })}
            </Reveal>
          </Section>
        ) : null}

        {related.length ? (
          <Section tone="vu-cream" pad="md" cv={false} labelledBy="stories-title">
            <SectionIntro
              id="stories-title"
              eyebrow="Stories"
              title={["Lives This Work Has Touched"]}
              actions={
                <ArrowLink href={routes.stories()} className="font-bold">
                  Read more stories
                </ArrowLink>
              }
            />
            {/* Fewer than three stories sit centred rather than leaving an empty column. */}
            <Reveal
              as="ul"
              stagger={0.1}
              y={30}
              className={
                related.length >= 3
                  ? "mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                  : related.length === 2
                    ? "mx-auto mt-12 grid max-w-[860px] gap-6 md:grid-cols-2"
                    : "mx-auto mt-12 grid max-w-[420px] gap-6"
              }
            >
              {related.map((s) => {
                const country = countryByCode(s.place);
                return (
                  <li key={s.id} className="flex">
                    <StoryCard
                      image={{ ...s.image, alt: "" }}
                      label={s.label}
                      meta={s.meta}
                      {...(country ? { place: { code: country.code, name: country.name } } : {})}
                      text={s.text}
                      href={routes.story(s.id)}
                      sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 90vw"
                      className="w-full"
                    />
                  </li>
                );
              })}
            </Reveal>
          </Section>
        ) : null}

        {faqs.length ? (
          <Section tone="white" pad="md" cv={false} labelledBy="programme-faq-title" width="reading">
            <SectionIntro id="programme-faq-title" eyebrow="Questions" title={["Common Questions"]} />
            <FaqList faqs={faqs} className="mt-10" />
            <p className="mt-8 text-center">
              <ArrowLink href={routes.faq()} className="font-bold">
                See all questions
              </ArrowLink>
            </p>
          </Section>
        ) : null}

        <Section id="contact" tone="paper" pad="md" cv={false} labelledBy="contact-title">
          <ProgrammeContact
            team={programme.contact.team}
            email={programme.contact.email}
            {...(phone
              ? {
                  phone: {
                    label: phone,
                    href: `tel:${phone.replace(/[^\d+]/g, "")}`,
                  },
                }
              : {})}
            {...((programme.contact.hours ?? contact.hours) ? { hours: programme.contact.hours ?? contact.hours } : {})}
            messageHref={askHref}
          />
        </Section>
      </div>

      {protection ? <CtaBand variant="safeguarding" emergencyNotice={safety.emergencyNotice} /> : <CtaBand />}
    </>
  );
}
