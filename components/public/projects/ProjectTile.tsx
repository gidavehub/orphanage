import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Badge } from "@/components/ui/Badge";
import { ProjectCard } from "@/components/ui/cards/ProjectCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { money } from "@/lib/money";
import { cn } from "@/lib/cn";
import { PROJECT_STATUS_TONE, PROJECT_STATUS_WORD, type ProjectTileData } from "./model";

/**
 * One project on /projects (public-pages §3.13): the landing ProjectCard (square photo, marigold brush
 * label that paints in on hover or focus) with a status pill, then a caption that is always visible,
 * on touch screens too (the title, country, programme, dates and summary) and, when the project is
 * raising money, its funding bar and "Support This Project".
 */
export function ProjectTile({ project: p, headingLevel = 3, className }: { project: ProjectTileData; headingLevel?: 2 | 3; className?: string }) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const f = p.funding;
  return (
    <article
      className={cn(
        "group/tile flex h-full flex-col rounded-card-lg bg-white p-3 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="relative">
        <ProjectCard
          title={p.title}
          subtitle={p.subtitle}
          image={p.image}
          href={p.href}
          sizes="(min-width:1280px) 400px, (min-width:768px) 46vw, 92vw"
        />
        <Badge tone={PROJECT_STATUS_TONE[p.status]} className="pointer-events-none absolute right-4 top-4 shadow-[0_6px_18px_-8px_rgba(6,21,18,0.45)]">
          {PROJECT_STATUS_WORD[p.status]}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-5">
        {p.place || p.programmeLabel ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {p.place ? (
              <Badge flag={p.place.code} tone="neutral" size="sm">
                {p.place.name}
              </Badge>
            ) : null}
            {p.programmeLabel ? <span className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-marigold-ink">{p.programmeLabel}</span> : null}
          </p>
        ) : null}
        <Heading className="mt-3 text-[22px] font-extrabold leading-tight text-ink">
          <Link href={p.href} className="rounded-sm transition-colors hover:text-forest">
            {p.title}
          </Link>
        </Heading>
        {p.summary ? <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-body">{p.summary}</p> : null}
        {p.when ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-body">
            <CalendarDays aria-hidden className="size-4 text-marigold-ink" />
            {p.when}
          </p>
        ) : null}

        {f ? (
          <div className="mt-auto pt-6">
            {f.figures ? (
              <div className="rounded-control bg-cream px-4 py-3.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-grotesk text-[13px] text-body">
                  <span>
                    <span className="font-bold text-ink">{money(f.figures.raised, f.figures.currency)}</span> raised
                  </span>
                  <span>of {money(f.figures.goal, f.figures.currency)}</span>
                </p>
                <ProgressBar percent={f.figures.percent} tone="forest" label={`${p.title}: ${Math.round(f.figures.percent)}% funded`} className="mt-2.5" />
              </div>
            ) : null}
            {f.closed ? null : (
              <ArrowLink href={f.href} className="mt-3 font-bold">
                Support This Project
              </ArrowLink>
            )}
          </div>
        ) : (
          <div className="mt-auto pt-5">
            <ArrowLink href={p.href} className="font-bold">
              Read the Project Story
            </ArrowLink>
          </div>
        )}
      </div>
    </article>
  );
}
