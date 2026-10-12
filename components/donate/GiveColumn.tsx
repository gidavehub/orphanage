import { Blocks, blocksToPlain } from "@/components/content/Blocks";
import type { Block, PageView, Resolved } from "@/lib/content/types";
import type { Currency } from "@/lib/model/enums";
import type { UiImage } from "@/lib/model/ui";
import { routes } from "@/lib/routes";
import { AllocationPanel } from "./AllocationPanel";
import { CauseList } from "./CauseList";
import { GiveHero } from "./GiveHero";
import { DonateFaq, ReachChild, TrustPanel } from "./GiveSections";
import { ImpactExamples } from "./ImpactExamples";
import { OtherWays } from "./OtherWays";
import type { WidgetCause } from "./model";

// The left column of /donate and /donate/[cause] (public-pages §4.3, §4.5): the give hero (order 1
// on phones, above the widget) and the sections below the widget (order 3). Presentational: the
// route loads everything through the cached readers (app/(site)/donate/(give)/_column.ts).

export type GiveColumnData = {
  general: boolean;
  cause: WidgetCause;
  title: string;
  summary: string;
  eyebrow: string;
  story: Resolved<Block[]>;
  otherTotals?: Partial<Record<Currency, number>>;
  page: PageView;
  /** /donate only: every live cause for "Choose a Cause". */
  causes: WidgetCause[];
  groups: Array<{ id: string; label: string }>;
  steps: Array<{ id: string; title: string; text: string; image?: UiImage }>;
  faqs: Array<{ id: string; q: string; a: string }>;
  registrations: Array<{ label: string; number: string }>;
  donationsEmail: string;
  methodsLine: string;
  report: { href: string; label: string };
};

function plain(section: PageView["sections"][string] | undefined): string | undefined {
  return section?.body?.length ? blocksToPlain(section.body) : undefined;
}

export function GiveColumn({ data }: { data: GiveColumnData }) {
  const { general, cause, page } = data;
  const s = page.sections;
  const pageFaqs = (s.questions?.items ?? []).map((it, i) => ({ id: `donate-q-${i}`, q: it.title, a: it.text ?? "" })).filter((f) => f.a);
  const seen = new Set(pageFaqs.map((f) => f.q.toLowerCase()));
  const faqItems = [...pageFaqs, ...data.faqs.filter((f) => !seen.has(f.q.toLowerCase()))];
  const zakat = cause.zakatEligible && s.zakat ? { title: s.zakat.title?.join(" ") ?? "Zakat", text: plain(s.zakat) ?? "" } : null;

  return (
    <>
      <GiveHero
        className="order-1"
        cause={cause}
        eyebrow={data.eyebrow}
        title={general ? page.hero.title : [data.title]}
        lead={general ? (page.hero.intro ?? data.summary) : data.summary}
        crumbs={general ? [{ label: "Donate" }] : [{ label: "Donate", href: routes.donate() }, { label: data.title }]}
        closedNote={plain(s.closed)}
        cancelledNote={plain(s.cancelled) ?? "Your payment was cancelled and nothing was charged. Your choices are saved below."}
        shareLabel={s.share?.title?.join(" ") ?? "Share this appeal"}
        otherTotals={data.otherTotals}
      />

      <div className="order-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-16 md:gap-20 lg:mt-20">
        {general ? (
          <CauseList
            causes={data.causes}
            groups={data.groups}
            eyebrow={s.chooseCause?.eyebrow}
            title={s.chooseCause?.title ?? ["Choose a Cause"]}
            intro={plain(s.chooseCause)}
          />
        ) : null}

        {cause.allocation.length ? (
          <AllocationPanel cause={cause} eyebrow={s.whereItGoes?.eyebrow} title={s.whereItGoes?.title?.join(" ") ?? "Where Your Money Goes"} note={plain(s.whereItGoes)} />
        ) : null}

        <ImpactExamples cause={cause} eyebrow={s.examples?.eyebrow} title={s.examples?.title?.join(" ") ?? "What Your Gift Can Do"} intro={plain(s.examples)} />

        {data.story.length ? (
          <section aria-label={`About ${data.title}`} className="rounded-card-lg bg-white p-6 shadow-soft sm:p-8 md:p-10">
            <Blocks blocks={data.story} idPrefix="story-" />
          </section>
        ) : null}

        <ReachChild
          eyebrow={s.reachChild?.eyebrow}
          title={s.reachChild?.title ?? ["How We Make Sure It", "Reaches a Child"]}
          intro={plain(s.reachChild)}
          steps={data.steps}
        />

        <TrustPanel
          eyebrow={s.trust?.eyebrow}
          title={s.trust?.title ?? ["Your Gift Is Safe With Us"]}
          items={s.trust?.items ?? []}
          registrations={data.registrations}
          impactHref={routes.impact()}
          reportHref={data.report.href}
          reportLabel={data.report.label}
        />

        <OtherWays
          eyebrow={s.otherWays?.eyebrow}
          title={s.otherWays?.title ?? ["Other Ways to Give"]}
          intro={plain(s.otherWays)}
          items={(s.otherWays?.items ?? []).map((it) => ({ title: it.title, ...(it.text ? { text: it.text } : {}) }))}
          partnerHref={routes.partner({ type: "donation_partnership" })}
          donationsEmail={data.donationsEmail}
          methodsLine={data.methodsLine}
          zakat={zakat}
        />

        <DonateFaq eyebrow={s.questions?.eyebrow} title={s.questions?.title ?? ["About Giving"]} items={faqItems} />
      </div>
    </>
  );
}
