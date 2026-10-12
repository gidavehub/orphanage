import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { Button } from "../Button";
import type { ProgrammeId } from "@/lib/model/enums";
import { cn } from "@/lib/cn";

export type ProgrammeCardProps = {
  /** Programme id: picks the duotone icon. */
  programme: ProgrammeId;
  title: string;
  summary: string;
  /** The italic forest line under the summary (disclaimer, "Free and confidential"). */
  notice?: string;
  /** Where "Learn More" goes (the programme page). */
  href: string;
  cta?: string;
  /**
   * `aa` (default): the button carries night text on marigold (9.8:1).
   * `landing`: the approved landing pairing (white on marigold), for the home section only.
   */
  contrast?: "aa" | "landing";
  headingLevel?: 2 | 3;
  as?: "article" | "li";
  className?: string;
};

/**
 * The Donat icon-tab card from the landing Programmes section (design-system §3.7), markup copied so
 * P2 can adopt it pixel for pixel. Grids that hold it need `mt-24 gap-y-24` (the tab overhangs).
 */
export function ProgrammeCard({
  programme,
  title,
  summary,
  notice,
  href,
  cta = "Learn More",
  contrast = "aa",
  headingLevel = 3,
  as: As = "article",
  className,
}: ProgrammeCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <As
      className={cn(
        "group relative flex flex-col rounded-card-lg bg-white px-8 pb-10 pt-[74px] text-center shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-2 hover:shadow-card-hover",
        className,
      )}
    >
      {/* Donat's icon tab: a white disc riding the card edge, half-ringed in marigold */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid size-[118px] place-items-center rounded-full bg-white">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-[9px] border-marigold-100 [clip-path:inset(0_0_50%_0)] transition-[border-color] duration-500 group-hover:border-marigold/60"
          />
          <ProgrammeIcon name={programme} className="size-[58px]" />
        </div>
      </div>

      <Heading className="text-[23px] font-bold leading-tight text-ink">{title}</Heading>
      <p className="mx-auto mt-4 max-w-[330px] text-[16px] leading-[1.75] text-body">{summary}</p>
      {notice ? <p className="mt-3 text-[13px] font-semibold italic text-forest">{notice}</p> : null}
      <div className="mt-auto pt-7">
        <Button
          href={href}
          variant={contrast === "landing" ? "marigold" : "marigold-ink"}
          size="sm"
          className={contrast === "landing" ? "group-hover:bg-forest" : "group-hover:bg-forest group-hover:text-white"}
          aria-label={`${cta} about ${title}`}
        >
          {cta}
        </Button>
      </div>
    </As>
  );
}
