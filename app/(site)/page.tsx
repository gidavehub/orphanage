import type { Metadata } from "next";
import type { ComponentType } from "react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FinalCta } from "@/components/public/home/FinalCta";
import { About } from "@/components/sections/About";
import { Appeals } from "@/components/sections/Appeals";
import { Donate } from "@/components/sections/Donate";
import { DoorsOpen } from "@/components/sections/DoorsOpen";
import { Duo } from "@/components/sections/Duo";
import { Faq } from "@/components/sections/Faq";
import { Focus } from "@/components/sections/Focus";
import { Founder } from "@/components/sections/Founder";
import { Hero } from "@/components/sections/Hero";
import { Impact } from "@/components/sections/Impact";
import { JoinSphere } from "@/components/sections/JoinSphere";
import { Journey } from "@/components/sections/Journey";
import { Manifesto } from "@/components/sections/Manifesto";
import { News } from "@/components/sections/News";
import { Partners } from "@/components/sections/Partners";
import { Programmes } from "@/components/sections/Programmes";
import { Projects } from "@/components/sections/Projects";
import { Restoring } from "@/components/sections/Restoring";
import { Stories } from "@/components/sections/Stories";
import { Team } from "@/components/sections/Team";
import { Testimonials } from "@/components/sections/Testimonials";
import { WorldFlags } from "@/components/sections/WorldFlags";
import { JsonLd } from "@/components/seo/JsonLd";
import { getHomeContent, getSiteSettings } from "@/lib/content/public";
import type { HomeView } from "@/lib/content/types";
import type { OptionalHomeSection } from "@/lib/content/schema";
import { baseUrl } from "@/lib/server/url";

// Appeals and Donate belong to P3 (PLAN §6.1). They take their slices as props (content-model §4.8):
// these views name the props the page passes, so the page compiles while P3 moves each section from
// its legacy imports onto these props (a component that ignores props is assignable to them).
const AppealsSection = Appeals as ComponentType<{ section: HomeView["appeals"]["section"]; causes: HomeView["appeals"]["causes"]; showNote: boolean }>;
const DonateSection = Donate as ComponentType<{ donate: HomeView["donate"] }>;

/** The home page keeps the root's default title; it adds its canonical URL and Open Graph url (public-pages §7.1). */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    alternates: { canonical: "/" },
    openGraph: { title: `${site.name} | ${site.tagline}`, description: site.description, url: "/", siteName: site.name, type: "website" },
  };
}

/**
 * The Haven landing page: Donat's warmth interleaved with Voices United's editorial chapters. Every
 * section receives its slice of the cached getHomeContent() as props (content-model §4.7), sits in a
 * StudioSlot named after its content doc (D60), and the optional ones step aside when the content
 * team hides them or there is too little to show. Header, Footer and <main> come from the layout.
 */
export default async function Home() {
  const [c, site] = await Promise.all([getHomeContent(), getSiteSettings()]);
  const origin = baseUrl();
  const show = (s: OptionalHomeSection, enough: boolean) => enough && !c.hidden.includes(s);
  const showNews = show("news", c.news.posts.length > 0);

  return (
    <>
      {/* WebSite with the site search as its SearchAction (public-pages §7.2); the NGO record is in the root layout. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${origin}/#website`,
          name: site.name,
          url: `${origin}/`,
          description: site.description,
          publisher: { "@id": `${origin}/#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: `${origin}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <StudioSlot id="home.hero">
        <Hero hero={c.hero} />
      </StudioSlot>
      <StudioSlot id="home.world">
        <WorldFlags world={c.world} />
      </StudioSlot>
      {show("partners", c.partners.logos.length > 0) && (
        <StudioSlot id="home.partners">
          <Partners partners={c.partners} />
        </StudioSlot>
      )}
      <StudioSlot id="home.programmes">
        <Programmes section={c.programmes.section} programmes={c.programmes.items} />
      </StudioSlot>
      <StudioSlot id="home.about">
        <About about={c.about} />
      </StudioSlot>
      <StudioSlot id="home.duo">
        <Duo duo={c.duo} />
      </StudioSlot>
      <div aria-hidden className="h-12 bg-vu-cream" />
      <StudioSlot id="home.manifesto">
        <Manifesto manifesto={c.manifesto} />
      </StudioSlot>
      <StudioSlot id="home.impact">
        <Impact impact={c.impact} />
      </StudioSlot>
      <StudioSlot id="home.focus">
        <Focus focus={c.focus} />
      </StudioSlot>
      <StudioSlot id="home.appeals">
        <AppealsSection section={c.appeals.section} causes={c.appeals.causes} showNote={c.appeals.showNote} />
      </StudioSlot>
      <StudioSlot id="home.donate">
        <DonateSection donate={c.donate} />
      </StudioSlot>
      <StudioSlot id="home.doors">
        <DoorsOpen doors={c.doors} />
      </StudioSlot>
      {show("stories", c.stories.items.length >= 3) && (
        <StudioSlot id="home.stories">
          <Stories section={c.stories.section} stories={c.stories.items} />
        </StudioSlot>
      )}
      <StudioSlot id="home.founder">
        <Founder founder={c.founder} />
      </StudioSlot>
      {show("team", c.team.members.length >= 2) && (
        <StudioSlot id="home.team">
          <Team section={c.team.section} team={c.team.members} />
        </StudioSlot>
      )}
      <StudioSlot id="home.restoring">
        <Restoring restoring={c.restoring} />
      </StudioSlot>
      {show("testimonials", c.testimonials.items.length > 0) && (
        <StudioSlot id="home.testimonials">
          <Testimonials section={c.testimonials.section} testimonials={c.testimonials.items} />
        </StudioSlot>
      )}
      <StudioSlot id="home.journey">
        <Journey journey={c.journey} />
      </StudioSlot>
      {show("projects", c.projects.items.length === 3) && (
        <StudioSlot id="home.projects">
          <Projects section={c.projects.section} projects={c.projects.items} />
        </StudioSlot>
      )}
      <StudioSlot id="home.faq">
        <Faq section={c.faq.section} faq={c.faq.items} />
      </StudioSlot>
      <StudioSlot id="home.join">
        <JoinSphere join={c.join} />
      </StudioSlot>
      {showNews && (
        <StudioSlot id="home.news">
          <News section={c.news.section} news={c.news.posts} last={!c.finalCta.visible} />
        </StudioSlot>
      )}
      {/* D128: the spec's closing band, seeded hidden so the approved landing stays as it is. */}
      {c.finalCta.visible && (
        <StudioSlot id="home.finalCta">
          <FinalCta finalCta={c.finalCta} />
        </StudioSlot>
      )}
    </>
  );
}
