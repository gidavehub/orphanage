import { Info } from "lucide-react";
import { DoodleField } from "@/components/art/Decor";
import { Button } from "@/components/ui/Button";
import { CauseCard } from "@/components/ui/cards/CauseCard";
import { ResourceCard } from "@/components/ui/cards/ResourceCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";
import type { CauseCard as CauseCardView } from "@/lib/content/types";
import { countryName } from "@/lib/countries";
import type { ResourceSummary } from "@/lib/model/dto";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

/**
 * The appeals on /impact (public-pages §3.12 item 7): the landing's cause cards, but "Donate Now"
 * opens each cause's own page (`/donate/<slug>`), where the donor sees exactly where the money goes,
 * instead of the landing's in-page donate card. A swipe row on phones, a grid from tablets.
 */
export function ImpactAppeals({
  causes,
  eyebrow,
  title,
  intro,
  note,
}: {
  causes: CauseCardView[];
  eyebrow: string;
  title: string[];
  intro: string;
  /** "Appeal figures are illustrative…" while any shown figure is unverified. */
  note: string | null;
}) {
  if (!causes.length) return null;
  const shown = causes.slice(0, 6);
  return (
    <section aria-labelledby="impact-appeals-title" className="bg-white py-20 md:py-28">
      <div className="wrap-wide">
        <div className="paper relative overflow-hidden rounded-[40px] px-5 py-16 md:rounded-[60px] md:px-10 md:py-20">
          <DoodleField className="pointer-events-none absolute -left-10 -top-20 w-[520px] max-w-[60%] opacity-70" />
          <div className="wrap relative !px-0">
            <SectionIntro id="impact-appeals-title" eyebrow={eyebrow} title={title} intro={intro} />
            <ul className="-mx-1 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
              {shown.map((c) => (
                <li key={c.slug} className="w-[84%] max-w-[380px] shrink-0 snap-start md:w-auto md:max-w-none">
                  <CauseCard
                    title={c.title}
                    season={c.season}
                    {...(c.place ? { place: { code: c.place, name: countryName(c.place) } } : {})}
                    image={c.image}
                    raised={c.showFigures ? c.raised : null}
                    goal={c.goal}
                    currency={c.currency}
                    tone={c.tone}
                    href={c.href}
                    cta="Donate Now"
                    sizes="(min-width:1280px) 380px, (min-width:768px) 45vw, 84vw"
                    className="h-full"
                  />
                </li>
              ))}
            </ul>
            <div className={cn("mt-10 flex flex-col items-center gap-5 text-center")}>
              {note ? (
                <p className="flex max-w-[640px] items-start gap-2 text-[14px] leading-relaxed text-body">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.25} />
                  <span>{note}</span>
                </p>
              ) : null}
              <Button href={`${routes.donate()}#causes`} variant="forest" icon="arrow">
                See Every Cause
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Three reports from the library (public-pages §3.12 item 8) and "All reports". */
export function ImpactReports({ reports, eyebrow, title, cta }: { reports: ResourceSummary[]; eyebrow: string; title: string[]; cta: { label: string; href: string } }) {
  if (!reports.length) return null;
  return (
    <section aria-labelledby="impact-reports-title" className="paper py-20 md:py-28">
      <div className="wrap">
        <SectionIntro
          id="impact-reports-title"
          eyebrow={eyebrow}
          title={title}
          intro="Our annual and programme reports: what we did, what it cost and what changed. Public reports download straight away; others are sent on request."
        />
        <Reveal
          as="ul"
          stagger={0.1}
          className={cn("mx-auto mt-12 grid gap-7 md:grid-cols-2", reports.length >= 3 ? "lg:grid-cols-3" : reports.length === 2 ? "max-w-[820px]" : "max-w-[400px] md:grid-cols-1")}
        >
          {reports.map((r) => {
            const date = r.publicationDate ? new Date(r.publicationDate) : null;
            return (
              <li key={r.id} className="grid">
                <ResourceCard
                  title={r.title}
                  {...(r.cover ? { cover: r.cover } : {})}
                  date={date ? monthYear.format(date) : "Coming soon"}
                  {...(date ? { dateTime: date.toISOString().slice(0, 10) } : {})}
                  category={RESOURCE_CATEGORY_LABEL[r.category]}
                  summary={r.shortDescription}
                  access={r.access === "public" ? "public" : "request"}
                  {...(r.file ? { file: { size: fileSize(r.file.sizeBytes), type: "PDF" } } : {})}
                  href={routes.resource(r.slug)}
                  {...(r.access === "public" && r.file ? { downloadHref: routes.resourceDownload(r.slug) } : {})}
                  {...(r.access !== "public" ? { requestHref: routes.requestReport(r.slug) } : {})}
                />
              </li>
            );
          })}
        </Reveal>
        <p className="mt-12 text-center">
          <Button href={cta.href} variant="outline" icon="arrow">
            {cta.label}
          </Button>
        </p>
      </div>
    </section>
  );
}
