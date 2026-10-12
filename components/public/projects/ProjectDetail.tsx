import Link from "next/link";
import { BadgeCheck, CalendarDays, CircleDot, Layers, MapPin } from "lucide-react";
import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { DoodleField } from "@/components/art/Decor";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FlagDisc } from "@/components/ui/flag";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Reveal } from "@/components/ui/Reveal";
import type { ProgrammeId } from "@/lib/model/enums";
import { money } from "@/lib/money";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { PROJECT_STATUS_TONE, PROJECT_STATUS_WORD, type ProjectFunding, type ProjectTileData } from "./model";

/**
 * The facts bar under a project's hero (public-pages §3.13): programme (a link), country, dates and
 * status in one white card that overlaps the hero's torn edge.
 */
export function ProjectFacts({ project: p, programmeHref }: { project: ProjectTileData; programmeHref: string | null }) {
  const facts: Array<{ key: string; label: string; icon: React.ReactNode; value: React.ReactNode }> = [];
  if (p.programmeLabel) {
    facts.push({
      key: "programme",
      label: "Programme",
      icon: p.programmeId ? <ProgrammeIcon name={p.programmeId as ProgrammeId} className="size-6" /> : <Layers aria-hidden className="size-5 text-forest" />,
      value: programmeHref ? (
        <Link href={programmeHref} className="underline decoration-marigold decoration-2 underline-offset-4 transition-colors hover:text-forest">
          {p.programmeLabel}
        </Link>
      ) : (
        p.programmeLabel
      ),
    });
  }
  if (p.place) {
    facts.push({ key: "place", label: "Where", icon: <FlagDisc code={p.place.code} className="size-6" />, value: p.place.name });
  }
  facts.push({ key: "when", label: "When", icon: <CalendarDays aria-hidden className="size-5 text-marigold-ink" />, value: p.when ?? "Dates to be confirmed" });
  facts.push({
    key: "status",
    label: "Status",
    icon: <CircleDot aria-hidden className="size-5 text-forest" />,
    value: <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_WORD[p.status]}</Badge>,
  });

  return (
    <div className="wrap relative z-[3] -mt-6 md:-mt-12">
      <dl
        className={cn(
          "mx-auto grid max-w-[1040px] gap-px overflow-hidden rounded-card-lg bg-line shadow-card",
          facts.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : facts.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2",
        )}
      >
        {facts.map((f) => (
          // dt and dd sit directly in the item (a <dl> allows nothing else); the icon rides in the dt.
          <div key={f.key} className="relative min-w-0 bg-white py-5 pl-[72px] pr-5 md:py-6 md:pl-[76px] md:pr-6">
            <dt className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-body">
              <span aria-hidden className="absolute left-5 top-[22px] grid size-10 place-items-center rounded-full bg-cream md:left-6 md:top-[26px]">
                {f.icon}
              </span>
              {f.label}
            </dt>
            <dd className="mt-1 text-[16px] font-bold leading-snug text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const OUTCOME_TONES = ["bg-clay text-white", "bg-marigold text-night", "bg-forest text-white", "bg-cocoa text-white"] as const;

/** Verified outcomes only (D50): big numbers on earth tones, with the "verified" mark. */
export function ProjectOutcomes({ outcomes }: { outcomes: Array<{ label: string; value: string }> }) {
  if (!outcomes.length) return null;
  return (
    <section aria-labelledby="outcomes-title" className="mt-14">
      <h2 id="outcomes-title" className="flex items-center gap-2 text-[22px] font-extrabold text-ink md:text-[26px]">
        What Changed
        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1 font-grotesk text-[12px] font-semibold text-forest-700">
          <BadgeCheck aria-hidden className="size-3.5" strokeWidth={2.5} />
          Verified
        </span>
      </h2>
      <Reveal as="ul" stagger={0.08} className="mt-6 grid gap-4 sm:grid-cols-2">
        {outcomes.map((o, i) => (
          <li key={`${o.label}-${i}`} className={cn("flex min-h-[150px] flex-col justify-between rounded-card p-6", OUTCOME_TONES[i % OUTCOME_TONES.length])}>
            <p className="font-display text-[52px] leading-none">{o.value}</p>
            <p className="mt-3 font-grotesk text-[14px] font-medium uppercase tracking-[0.06em]">{o.label}</p>
          </li>
        ))}
      </Reveal>
    </section>
  );
}

/** "Support This Project" (public-pages §3.13): the linked cause's progress and the donate link, as a wide band. */
export function ProjectFundingBlock({ funding: f, title, label = "Support This Project" }: { funding: ProjectFunding; title: string; label?: string }) {
  return (
    <section aria-labelledby="funding-title" className="relative isolate overflow-hidden rounded-card-lg bg-forest px-6 py-9 text-white md:px-12 md:py-12">
      <DoodleField className="pointer-events-none absolute -right-10 -top-16 -z-10 w-[520px] max-w-[70%] opacity-20" />
      <div className={cn("grid items-center gap-8", f.figures && "lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14")}>
        <div>
          <p className="font-script text-[28px] font-bold leading-none text-marigold">{f.closed ? "Thank you" : "Be part of it"}</p>
          <h2 id="funding-title" className="mt-3 text-balance text-[26px] font-extrabold leading-tight md:text-[34px]">
            {f.closed ? `${title} Is Fully Supported` : `Support ${title}`}
          </h2>
          <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-white/90">
            {f.closed
              ? "This appeal has closed. A gift today goes where it's needed most."
              : `Gifts to ${f.causeTitle} fund this work directly. You'll see exactly where your money goes before you give.`}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button href={f.closed ? routes.donate() : f.href} variant="marigold-ink" size="lg" icon="heart" iconFirst>
              {f.closed ? "Give Where It's Needed" : label}
            </Button>
            {f.closed ? null : (
              <Link href={`${f.href}#where-it-goes`} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-bold text-white underline decoration-marigold decoration-2 underline-offset-[6px] hover:text-marigold">
                <MapPin aria-hidden className="size-4" strokeWidth={2.5} />
                See where the money goes
              </Link>
            )}
          </div>
        </div>
        {f.figures ? (
          <div className="rounded-card bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-sm">
            <p className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.1em] text-white">Raised so far</p>
            <p className="mt-2 font-display text-[48px] leading-none">{money(f.figures.raised, f.figures.currency)}</p>
            <ProgressBar percent={f.figures.percent} tone="marigold" label={`${title}: ${Math.round(f.figures.percent)}% funded`} className="mt-5" />
            <p className="mt-3 flex justify-between gap-3 font-grotesk text-[14px] text-white">
              <span>{Math.min(100, Math.round(f.figures.percent))}% funded</span>
              <span>Goal {money(f.figures.goal, f.figures.currency)}</span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
