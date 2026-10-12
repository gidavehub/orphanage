import Image from "next/image";
import { Info } from "lucide-react";
import { BrushReveal } from "@/components/art/BrushReveal";
import { Brush } from "@/components/art/Brush";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RiseWords } from "@/components/ui/RiseWords";
import { ShareRow } from "@/components/ui/ShareRow";
import { FlagDisc } from "@/components/ui/flag";
import type { Currency } from "@/lib/model/enums";
import { money } from "@/lib/money";
import { cn } from "@/lib/cn";
import { CancelledNotice } from "./CancelledNotice";
import type { WidgetCause } from "./model";

/**
 * The left column's "give hero" (public-pages §4.3): breadcrumbs, the cancelled and closed banners,
 * the Caveat eyebrow, the H1 (Nunito 800, 34/48px), the lead, the cause photo painted in with the
 * patch brush over a forest frame, the place chip, raised-of-goal progress (figures only when they
 * may be shown; "Illustrative" when unverified) and the share row ("Share this appeal").
 */
export function GiveHero({
  cause,
  eyebrow,
  title,
  lead,
  crumbs,
  closedNote,
  cancelledNote,
  shareLabel,
  otherTotals,
  className,
}: {
  cause: WidgetCause;
  eyebrow: string;
  title: string[];
  lead: string;
  crumbs: Crumb[];
  closedNote?: string;
  cancelledNote: string;
  shareLabel: string;
  /** Online gifts in other currencies (shown separately, never summed). */
  otherTotals?: Partial<Record<Currency, number>>;
  className?: string;
}) {
  const pct = cause.showFigures && cause.goal > 0 ? (cause.raised / cause.goal) * 100 : null;
  const tone = cause.tone === "flame" ? "flame" : cause.tone === "clay" ? "clay" : "forest";
  const others = Object.entries(otherTotals ?? {}).filter(([, v]) => (v ?? 0) > 0) as Array<[Currency, number]>;

  return (
    <header className={cn("min-w-0", className)}>
      <Breadcrumbs items={crumbs} />
      <CancelledNotice text={cancelledNote} />
      {cause.closed && closedNote ? (
        <p role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-sand px-5 py-4 text-[15px] font-semibold leading-snug text-umber">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
          {closedNote}
        </p>
      ) : null}

      <Eyebrow tone="ink" lines="right" className="mt-8">
        {eyebrow}
      </Eyebrow>
      <h1 id="page-title" className="mt-4 text-balance text-[34px] font-extrabold leading-[1.12] tracking-[-0.01em] text-ink md:text-[48px]">
        {title.map((line, i) => (
          <span key={i} className="block">
            <RiseWords text={line} delay={120 + i * 200} />
          </span>
        ))}
      </h1>
      <p className="mt-5 max-w-[620px] text-[17px] leading-relaxed text-body md:text-[18px]">{lead}</p>

      {/* The photo: painted in with the patch brush over an offset forest frame (the About composition). */}
      <div className="relative mt-10 aspect-[16/11] w-full max-w-[680px] sm:aspect-[16/10]">
        <div aria-hidden className="absolute bottom-[2%] left-[4%] right-[10%] top-[12%] rounded-[38px] border-[12px] border-forest">
          <span className="absolute -bottom-[12px] left-[16%] h-[12px] w-[38%] bg-marigold" />
        </div>
        <BrushReveal immediate name="patch" direction="up" className="absolute -left-[3%] bottom-[-9%] right-[1%] top-[-6%]" duration={1.6} delay={0.15}>
          <div className="relative size-full">
            <Image
              src={cause.image.src}
              alt={cause.image.decorative ? "" : cause.image.alt}
              fill
              sizes="(min-width:1280px) 680px, (min-width:1024px) 50vw, 100vw"
              quality={75}
              loading="eager"
              fetchPriority="high"
              placeholder={cause.image.blurDataURL ? "blur" : "empty"}
              blurDataURL={cause.image.blurDataURL}
              style={cause.image.focal ? { objectPosition: `${cause.image.focal.x}% ${cause.image.focal.y}%` } : undefined}
              className="object-cover"
            />
            {cause.image.illustrative ? <ImageCredit position="static" className="absolute bottom-[18%] left-[16%]" /> : null}
          </div>
        </BrushReveal>
        <Brush name="drip" color="var(--color-marigold)" className="absolute -right-1 top-[4%] w-[13%] opacity-90" rotate={-18} />
        {cause.place ? (
          <span className="absolute right-[8%] top-[10%] z-[1] flex items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1 pr-3 text-[13px] font-bold text-ink shadow-thumb">
            <FlagDisc code={cause.place.code} className="size-6" />
            {cause.place.name}
          </span>
        ) : null}
      </div>

      {pct !== null ? (
        <div className="relative z-[1] mt-8 max-w-[680px] rounded-card bg-white p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <p className="font-grotesk text-[14px] text-body">
              Raised <strong className="font-display text-[30px] font-normal leading-none tracking-[0.01em] text-ink">{money(cause.raised, cause.currency)}</strong>{" "}
              of {money(cause.goal, cause.currency)}
            </p>
            <span className="flex items-center gap-2">
              {!cause.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-marigold-100 px-2.5 py-1 font-grotesk text-[11.5px] font-semibold uppercase tracking-[0.06em] text-umber">
                  <Info aria-hidden className="size-3" /> Illustrative
                </span>
              ) : null}
              <span className={cn("rounded-full px-3 py-1 font-grotesk text-[14px] font-semibold text-white", tone === "flame" ? "bg-coral-800" : tone === "clay" ? "bg-clay-700" : "bg-forest")}>
                {Math.round(pct)}%
              </span>
            </span>
          </div>
          <ProgressBar percent={pct} tone={tone} className="mt-4" label={`${cause.title}: ${Math.round(pct)}% of the goal raised`} />
          {others.length ? (
            <p className="mt-3 font-grotesk text-[13px] text-body">
              Also given online: {others.map(([c, v]) => money(v, c)).join(" · ")} (shown separately, never added together).
            </p>
          ) : null}
        </div>
      ) : null}

      <ShareRow className="mt-8" url={cause.href} title={cause.kind === "general" ? "Give to Haven" : cause.title} text={lead} label={shareLabel} />
    </header>
  );
}
