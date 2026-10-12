import type { Metadata } from "next";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { ctaOf, itemsOf, textOf, titleOf } from "@/components/public/about/page-copy";
import { FaqAnswer, FaqJsonLdBlock } from "@/components/public/faq/FaqAnswer";
import { FaqExplorer, type FaqExplorerGroup } from "@/components/public/faq/FaqExplorer";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { getFaqs, getPage } from "@/lib/content/public";
import { inlineToPlain } from "@/lib/content/inline";
import { FAQ_PLACEMENTS, type FaqPlacement } from "@/lib/content/schema";
import type { FaqView } from "@/lib/content/types";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";

// /faq (public-pages §3.20; PLAN D49): every public question, grouped by placement (donations =
// `donate`), with group pills and a search on the client, an accordion per group under its own <h2>,
// FAQPage JSON-LD and a "Still have a question?" band. Static; refreshed by col:faqs and pages.faq.

const DEFAULT_GROUPS: Array<{ label: string; placement: FaqPlacement }> = [
  { label: "Getting support", placement: "support" },
  { label: "Safeguarding & privacy", placement: "safeguarding" },
  { label: "Donations", placement: "donate" },
  { label: "Volunteering & partnerships", placement: "involved" },
  { label: "About Haven", placement: "about" },
];

/** URL-friendly group ids for the hash (#donations). */
const GROUP_ID: Partial<Record<FaqPlacement, string>> = { support: "support", safeguarding: "safeguarding", donate: "donations", involved: "involved", about: "about" };

const isPlacement = (v: string | undefined): v is FaqPlacement => !!v && (FAQ_PLACEMENTS as readonly string[]).includes(v);

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("faq");
  return buildMetadata({
    title: page.seo.title ?? "Frequently Asked Questions",
    description: page.seo.description ?? "Answers about getting support, safeguarding and privacy, donations, volunteering and Haven.",
    path: routes.faq(),
    noindex: page.seo.noindex === true,
  });
}

export default async function FaqPage() {
  const page = await getPage("faq");
  const configured = itemsOf(page, "groups")
    .filter((g): g is { title: string; icon: FaqPlacement } => isPlacement(g.icon))
    .map((g) => ({ label: g.title, placement: g.icon }));
  const groupDefs = configured.length ? configured : DEFAULT_GROUPS;
  const lists = await Promise.all(groupDefs.map((g) => getFaqs({ placement: g.placement })));

  const groups: FaqExplorerGroup[] = groupDefs
    .map((g, i) => ({
      id: GROUP_ID[g.placement] ?? g.placement,
      label: g.label,
      items: lists[i].map((f) => ({ id: f.id, q: f.q, plain: inlineToPlain(f.a), answer: <FaqAnswer text={f.a} /> })),
    }))
    .filter((g) => g.items.length > 0);

  const unique = new Map<string, FaqView>();
  for (const list of lists) for (const f of list) unique.set(f.id, f);

  const still = ctaOf(page, "stillQuestion", { label: "Contact Us", to: "contact" });
  const stillTitle = titleOf(page, "stillQuestion", ["Still Have a Question?"]).join(" ");

  return (
    <>
      <FaqJsonLdBlock faqs={[...unique.values()]} />

      <StudioSlot id="pages.faq">
        <PageHero
          variant="editorial"
          eyebrow={page.hero.eyebrow ?? "Frequently Asked Questions"}
          title={page.hero.title}
          intro={page.hero.intro ?? "Quick, honest answers about asking for help, keeping children safe, giving and getting involved."}
          crumbs={[{ label: "FAQ" }]}
          baseUrl={baseUrl()}
        />
      </StudioSlot>

      <Section tone="paper" pad="md" cv={false} label="Questions and answers">
        <FaqExplorer groups={groups} contactHref={routes.contact()} emptyText={textOf(page, "empty", "Ask us and we'll help.")} />
      </Section>

      <CtaBand
        title={stillTitle}
        text="If you can't find what you're looking for, write to us. A real person reads every message."
        actions={
          <>
            <Button href={still.href} variant="vu-white" size="lg" icon="none" className="min-w-[200px]">
              {still.label}
            </Button>
            <Button href={routes.getSupport()} variant="vu-outline" size="lg" icon="none" className="min-w-[200px]">
              Get Support
            </Button>
          </>
        }
      />
    </>
  );
}
