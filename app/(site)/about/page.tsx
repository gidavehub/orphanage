import type { Metadata } from "next";
import { Blocks } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { FounderNote } from "@/components/public/about/FounderNote";
import { OfficeCards } from "@/components/public/about/OfficeCards";
import { ctaOf, eyebrowOf, heroMediaOf, itemsOf, paragraphsOf, textOf, titleOf } from "@/components/public/about/page-copy";
import { TeamGallery, type TeamGalleryMember } from "@/components/public/about/TeamGallery";
import { ValuesGrid } from "@/components/public/about/ValuesGrid";
import { VisionMission } from "@/components/public/about/VisionMission";
import { WhoWeAre } from "@/components/public/about/WhoWeAre";
import { Journey } from "@/components/sections/Journey";
import { Partners } from "@/components/sections/Partners";
import { Testimonials } from "@/components/sections/Testimonials";
import { WorldFlags } from "@/components/sections/WorldFlags";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getContact, getHomeContent, getPage, getSiteSettings, getTeam } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /about (public-pages §3.2): who Haven is, its vision, mission and values, how it works, the founder,
// the team (bios in a Sheet), testimonials, partners and where it works. Static: every read is a
// cached getter refreshed by its content tag. The landing sections reused here take the same slices
// of getHomeContent() the landing passes them, so an edit in the studio shows in both places.

const FALLBACK_VALUES = [
  { title: "Child-centred", text: "Every decision starts with the child's safety, dignity and best interests." },
  { title: "Compassion", text: "We meet every child and family with kindness and without judgement." },
  { title: "Integrity", text: "We do what we say, and we say what we do." },
  { title: "Inclusion", text: "We serve children of every background, faith and ability." },
  { title: "Accountability", text: "We are transparent about our work, our finances and our impact." },
  { title: "Collaboration", text: "Lasting change is built with communities, professionals and partners." },
  { title: "Confidentiality", text: "Personal stories and records are protected and shared only with consent." },
];

/** Only real profile links reach the page: "#" placeholders would be dead links (P8 links.mjs). */
const realLink = (href: string) => /^https:\/\//.test(href);

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  return buildMetadata({
    title: page.seo.title ?? "About Us",
    description: page.seo.description ?? page.hero.intro ?? "Who Haven is, what we believe and how we work with children, families and communities.",
    path: routes.about(),
    noindex: page.seo.noindex === true,
  });
}

export default async function AboutPage() {
  const [page, home, team, contact, site] = await Promise.all([getPage("about"), getHomeContent(), getTeam({ on: "about" }), getContact(), getSiteSettings()]);
  const origin = baseUrl();

  const whoParagraphs = paragraphsOf(page, "whoWeAre");
  const values = itemsOf(page, "values");
  const partnerCta = ctaOf(page, "partners", { label: "Partner With Us", to: "partner" });
  const founderBio = paragraphsOf(page, "founder");
  const permissionNote = textOf(page, "testimonials", "Shared with permission.");
  const showTestimonials = home.testimonials.items.length > 0 && !home.hidden.includes("testimonials");
  const showPartners = home.partners.logos.length > 0 && !home.hidden.includes("partners");

  const members: TeamGalleryMember[] = team.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    image: m.image,
    socials: m.socials.filter((s) => realLink(s.href)),
    languages: m.languages,
    hasBio: m.bio.length > 0,
    bio: m.bio.length ? <Blocks blocks={m.bio} prose={false} measure={false} idPrefix={`${m.id}-`} /> : null,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": `${origin}${routes.about()}#page`,
          url: `${origin}${routes.about()}`,
          name: `About ${site.name}`,
          description: page.hero.intro ?? site.description,
          about: { "@id": `${origin}/#org` },
        }}
      />

      <StudioSlot id="pages.about">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          media={heroMediaOf(page.hero.media)}
          crumbs={[{ label: "About Us" }]}
          next="white"
          baseUrl={origin}
        />
      </StudioSlot>

      <WhoWeAre
        eyebrow={eyebrowOf(page, "whoWeAre", "Who We Are") ?? "Who We Are"}
        title={titleOf(page, "whoWeAre", ["Restoring Hope", "One Child at a Time"])}
        paragraphs={whoParagraphs.length ? whoParagraphs : home.about.body}
        image={home.about.image}
        actions={[
          { label: "Explore Our Programmes", href: routes.programmes() },
          { label: "See Our Impact", href: routes.impact() },
        ]}
      />

      <VisionMission
        cards={[
          { label: eyebrowOf(page, "vision", "Vision") ?? "Vision", text: textOf(page, "vision", home.about.vision) },
          {
            label: eyebrowOf(page, "mission", "Mission") ?? "Mission",
            text: textOf(
              page,
              "mission",
              "To protect vulnerable children, enhance their economic prosperity, and strengthen families by connecting them with education, healthcare, psychosocial support, legal assistance and sustainable community-based opportunities.",
            ),
          },
        ]}
      />

      <Section tone="paper" pad="md" cv={false} labelledBy="values-title" id="values">
        <SectionIntro id="values-title" eyebrow={eyebrowOf(page, "values", "What Guides Us")} title={titleOf(page, "values", ["Our Values"])} />
        <ValuesGrid values={values.length ? values : FALLBACK_VALUES} className="mt-12 md:mt-14" />
      </Section>

      {/* How we work: the landing Journey, unchanged (public-pages §3.2.5). */}
      <div id="approach" className="scroll-mt-24">
        <Journey journey={{ ...home.journey, title: titleOf(page, "approach", [home.journey.title]).join(" ") }} />
      </div>

      <FounderNote founder={home.founder} bio={founderBio} />

      {members.length ? (
        <section id="team" aria-labelledby="team-title" className="scroll-mt-24 bg-white pb-24 pt-4 md:pb-28">
          <div className="wrap">
            <SectionIntro
              id="team-title"
              eyebrow={eyebrowOf(page, "team", "Our Team")}
              title={titleOf(page, "team", ["Meet the People Behind Haven"])}
              intro="The people who answer your messages, visit families and follow every case through. Open a card to read more."
            />
            <div className="mt-14">
              <TeamGallery members={members} />
            </div>
          </div>
        </section>
      ) : null}

      {showTestimonials ? (
        <div>
          <Testimonials
            section={{ ...home.testimonials.section, eyebrow: eyebrowOf(page, "testimonials", home.testimonials.section.eyebrow) ?? home.testimonials.section.eyebrow, lines: titleOf(page, "testimonials", home.testimonials.section.lines) }}
            testimonials={home.testimonials.items}
          />
          <p className="-mt-14 bg-white pb-16 text-center font-grotesk text-[13px] text-body md:-mt-20 md:pb-20">{permissionNote}</p>
        </div>
      ) : null}

      {showPartners ? (
        <div id="partners" className="paper scroll-mt-24">
          <Partners partners={home.partners} />
          <Reveal className="flex justify-center pb-16 pt-8 md:pb-20">
            <Button href={partnerCta.href} variant="forest" size="lg">
              {partnerCta.label}
            </Button>
          </Reveal>
        </div>
      ) : null}

      <div id="where-we-work" className="paper scroll-mt-24">
        <WorldFlags world={home.world} />
        <section aria-labelledby="offices-title" className="wrap pb-24 pt-4 md:pb-28">
          <SectionIntro id="offices-title" eyebrow={eyebrowOf(page, "whereWeWork", "Where We Work")} title={titleOf(page, "whereWeWork", ["Our Offices"])} />
          <OfficeCards offices={contact.offices} hours={contact.hours} className="mx-auto mt-12 max-w-[960px]" />
        </section>
      </div>

      <CtaBand />
    </>
  );
}
