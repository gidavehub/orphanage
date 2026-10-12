import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { Button } from "@/components/ui/Button";
import { ProgrammeCard } from "@/components/ui/cards/ProgrammeCard";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import type { CauseView, ResolvedProgramme } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/**
 * The six programme cards on /programmes (public-pages §3.3.2): the landing's icon-tab card with
 * "Learn More", the italic card notice, and a quiet "Request support" link under each card
 * (child protection goes to the concern form first).
 */
export function ProgrammeGrid({ programmes }: { programmes: ResolvedProgramme[] }) {
  return (
    <Reveal as="ul" stagger={0.1} className="mt-24 grid gap-x-7 gap-y-24 md:grid-cols-2 xl:grid-cols-3">
      {programmes.map((p) => (
        <li key={p.id} className="flex flex-col">
          <ProgrammeCard programme={p.id} title={p.title} summary={p.summary} notice={p.cardNotice} href={p.href} as="article" className="flex-1" />
          <Link
            href={p.requestHref}
            className="group mx-auto mt-4 inline-flex min-h-11 items-center gap-2 px-3 text-[15px] font-bold text-forest underline decoration-marigold decoration-2 underline-offset-[6px] transition-colors hover:text-ink"
          >
            {p.id === "protection" ? "Report a concern" : "Request support"}
            <span className="sr-only"> for {p.title}</span>
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
          </Link>
        </li>
      ))}
    </Reveal>
  );
}

const FILL: Record<string, string> = {
  forest: "bg-forest",
  marigold: "bg-marigold",
  clay: "bg-clay",
  cocoa: "bg-cocoa",
  coral: "bg-coral-800",
  umber: "bg-umber",
  deep: "bg-deep",
};
const ORDER = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"];

/**
 * A programme cause on /programmes "Fund a programme" (public-pages §3.3.5, §4.5): the CauseCard
 * look (photo, season, title) with the allocation mini-bar and "Give to this programme". Programme
 * causes have no goal, so there is no progress bar; the mini-bar shows only while figures may be
 * shown (D38, D46), otherwise the uses are listed without percentages.
 */
export function FundCard({ cause, programme }: { cause: CauseView; programme: ResolvedProgramme }) {
  const parts = cause.allocation.map((p, i) => ({ ...p, tone: p.tone ?? ORDER[i % ORDER.length] }));
  const total = Math.max(100, parts.reduce((s, p) => s + Math.max(0, p.percent), 0));
  const summary = parts
    .slice(0, 3)
    .map((p) => (cause.showFigures ? `${Math.round(p.percent)}% ${p.label.toLowerCase()}` : p.label.toLowerCase()))
    .join(", ");
  return (
    <article className="group flex h-full flex-col rounded-card bg-white p-[22px] shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-[26px]">
      <div className="relative aspect-[362/238] overflow-hidden rounded-tile">
        <Image
          src={cause.image.src}
          alt={cause.image.decorative ? "" : cause.image.alt}
          fill
          sizes="(min-width:1280px) 400px, (min-width:768px) 50vw, 90vw"
          placeholder={cause.image.blurDataURL ? "blur" : "empty"}
          blurDataURL={cause.image.blurDataURL}
          style={cause.image.objectPosition ? { objectPosition: cause.image.objectPosition } : undefined}
          className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-110"
        />
        <span aria-hidden className="absolute left-3 top-3 grid size-12 place-items-center rounded-full bg-white shadow-thumb">
          <ProgrammeIcon name={programme.id} className="size-7" />
        </span>
        {cause.image.illustrative ? <ImageCredit position="bottom-left" /> : null}
      </div>
      <p className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-forest">{cause.season || "Year-round"}</p>
      <h3 className="mt-1 text-[22px] font-semibold leading-[1.35] text-ink">{programme.title}</h3>
      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-body">{programme.navBlurb}</p>

      {parts.length ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-body">Where it goes</p>
            {!cause.verified && cause.showFigures ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-marigold-100 px-2.5 py-0.5 font-grotesk text-[11px] font-semibold uppercase tracking-[0.06em] text-umber">
                <Info aria-hidden className="size-3" /> Illustrative
              </span>
            ) : null}
          </div>
          {cause.showFigures ? (
            <div aria-hidden className="mt-2.5 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-pebble">
              {parts.map((p, i) => (
                <span key={`${p.label}-${i}`} className={cn("h-full first:rounded-l-full last:rounded-r-full", FILL[p.tone])} style={{ width: `${(Math.max(0, p.percent) / total) * 100}%` }} />
              ))}
            </div>
          ) : null}
          <p className="mt-2.5 text-[14px] leading-snug text-body">
            <span className="sr-only">Where a gift goes: </span>
            {summary.charAt(0).toUpperCase() + summary.slice(1)}
            {parts.length > 3 ? " and more" : ""}.
          </p>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <Button href={cause.href} variant="forest" size="sm" aria-label={`Give to ${programme.title}`}>
          Give to this programme
        </Button>
      </div>
    </article>
  );
}
