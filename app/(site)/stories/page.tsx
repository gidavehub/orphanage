import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { blocksToPlain } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { StoryWall, type WallStory } from "@/components/public/stories/StoryWall";
import { Stories } from "@/components/sections/Stories";
import { Testimonials } from "@/components/sections/Testimonials";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Notice } from "@/components/ui/Notice";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { getHomeContent, getPage, getProgrammes, getStories } from "@/lib/content/public";
import type { CtaView } from "@/lib/content/types";
import { countryName } from "@/lib/countries";
import { isRouteKey, routeHref, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";

// /stories (public-pages §3.14, PLAN D50, D121): the editorial hero and the landing's featured
// capsules form the page's one Voices United chapter; then every story as a picture-and-paragraph
// card with its own anchor (#s-<id>) and "Copy link"; the consent line; donor-first testimonials; and
// the "Tell Your Story" band. Fully static: the programme filter runs in the browser.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("stories");
  return buildMetadata({
    title: page.seo.title ?? "Stories of Hope",
    description: page.seo.description ?? page.hero.intro ?? "Stories of hope from the families Haven serves.",
    path: routes.stories(),
    noindex: page.seo.noindex === true,
  });
}

export default async function StoriesPage() {
  const [page, all, featured, programmes, home] = await Promise.all([
    getPage("stories"),
    getStories(),
    getStories({ featured: true }),
    getProgrammes(),
    getHomeContent(),
  ]);
  const s = page.sections;

  const programmeTitle = new Map(programmes.map((p) => [p.id as string, p.title]));
  const wall: WallStory[] = all.map((st) => ({
    id: st.id,
    label: st.label,
    meta: st.meta,
    text: st.text,
    image: st.image,
    place: st.place ? { code: st.place, name: countryName(st.place) } : null,
    programme: st.programmeId ?? null,
  }));
  const withStories = new Set(all.map((st) => st.programmeId).filter(Boolean));
  const filterProgrammes = programmes.filter((p) => withStories.has(p.id)).map((p) => ({ id: p.id as string, label: programmeTitle.get(p.id) ?? p.title }));

  const tell: CtaView = s.share?.cta && isRouteKey(s.share.cta.to) ? { label: s.share.cta.label, href: routeHref(s.share.cta.to), to: s.share.cta.to } : { label: "Tell Your Story", href: routes.shareStory(), to: "tellStory" };
  const capsules = featured.length >= 3 ? featured : all.slice(0, 9);
  const consent = blocksToPlain(s.consent?.body ?? []) || "Every story is shared with written permission. We never publish children's names or exact locations.";

  return (
    <>
      <StudioSlot id="pages.stories">
        <PageHero variant="editorial" eyebrow={page.hero.eyebrow} title={page.hero.title} intro={page.hero.intro} crumbs={[{ label: "Stories" }]} />
      </StudioSlot>

      {capsules.length ? (
        <Stories
          section={{
            title: s.featured?.title ?? ["In Their", "Own Words"],
            intro: blocksToPlain(s.featured?.body ?? []) || "Hover or tap a portrait to read their story.",
            ctas: [tell, { label: s.featured?.cta?.label ?? "All Stories", href: "#all-stories", to: "stories" }],
          }}
          stories={capsules}
        />
      ) : null}

      <Section id="all-stories" tone="paper" pad="md" labelledBy="all-stories-title" className="scroll-mt-24">
        <Reveal className="text-center">
          <Eyebrow>{s.all?.eyebrow ?? "Every Story"}</Eyebrow>
          <DonatHeading id="all-stories-title" lines={s.all?.title ?? ["Change, Told by the", "People Who Lived It"]} className="mt-4" />
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.75] text-body">
            {blocksToPlain(s.all?.body ?? []) || "Families, volunteers and partners across the communities we serve. Choose a programme to read the stories behind it."}
          </p>
        </Reveal>
        <div className="mt-10">
          <StoryWall stories={wall} programmes={filterProgrammes} path={routes.stories()} />
        </div>
        <Notice tone="disclaimer" icon={ShieldCheck} title="Shared with permission" className="mx-auto mt-6 max-w-[760px]">
          {consent}
        </Notice>
      </Section>

      {home.testimonials.items.length ? <Testimonials section={home.testimonials.section} testimonials={home.testimonials.items} /> : null}

      <CtaBand
        id="share-cta-title"
        title={s.share?.title?.join(" ") ?? "Has Haven Made a Difference for You?"}
        text={blocksToPlain(s.share?.body ?? []) || "Your story could help another family find the courage to ask for help. We'll check every word with you before it's shared."}
        actions={
          <Button href={tell.href} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[220px]">
            {tell.label}
          </Button>
        }
      />
    </>
  );
}
