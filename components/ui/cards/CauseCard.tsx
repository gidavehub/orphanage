import Image from "next/image";
import { Button } from "../Button";
import { ProgressBar } from "../ProgressBar";
import { ImageCredit } from "../ImageCredit";
import { FlagDisc } from "../flag";
import { money } from "@/lib/money";
import type { Currency } from "@/lib/model/enums";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type CauseCardProps = {
  title: string;
  /** The small uppercase line above the title ("Ramadan", "Year-round"). */
  season?: string;
  /** Where the cause is: a round flag and the country name over the photo. */
  place?: { code: string; name: string };
  image: UiImage;
  /**
   * Raised so far, in MAJOR units of `currency`. `null` hides the progress (shown only when the
   * cause's figures are verified, D38).
   */
  raised: number | null;
  /** Goal in major units. */
  goal: number;
  currency: Currency;
  tone: "flame" | "forest" | "clay";
  href: string;
  cta?: string;
  /** Client parents only (the landing's requestDonation). */
  onCtaClick?: () => void;
  /**
   * `aa` (default): flame text and fills become coral-800 so small white text passes AA.
   * `landing`: the approved landing pairing, for the home Appeals carousel only.
   */
  contrast?: "aa" | "landing";
  headingLevel?: 2 | 3;
  sizes?: string;
  className?: string;
};

/** The appeal card from the landing Appeals carousel (design-system §3.7), with explicit props. */
export function CauseCard({
  title,
  season,
  place,
  image,
  raised,
  goal,
  currency,
  tone,
  href,
  cta = "Donate Now",
  onCtaClick,
  contrast = "aa",
  headingLevel = 3,
  sizes = "(min-width:1280px) 400px, (min-width:768px) 50vw, 90vw",
  className,
}: CauseCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const aa = contrast === "aa";
  const flame = tone === "flame";
  const toneText = flame ? (aa ? "text-coral-800" : "text-flame") : tone === "forest" ? "text-forest" : "text-clay";
  const toneBg = flame ? (aa ? "bg-coral-800" : "bg-flame") : tone === "forest" ? "bg-forest" : "bg-clay";
  const pct = raised === null || goal <= 0 ? null : (raised / goal) * 100;

  return (
    <article className={cn("group flex h-full flex-col rounded-card bg-white p-[26px] shadow-[0_20px_50px_-36px_rgba(20,51,43,0.4)]", className)}>
      <div className="relative aspect-[362/238] overflow-hidden rounded-tile">
        <Image
          src={image.src}
          alt={image.decorative ? "" : image.alt}
          fill
          sizes={sizes}
          placeholder={image.blurDataURL ? "blur" : "empty"}
          blurDataURL={image.blurDataURL}
          style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
          className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-110"
        />
        {place ? (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-3 text-[13px] font-bold text-ink backdrop-blur">
            <FlagDisc code={place.code} className="size-6" />
            {place.name}
          </span>
        ) : null}
        {pct !== null ? (
          <span className={cn("absolute right-3 top-3 rounded-full px-3 py-1 text-[15px] font-semibold text-white", toneBg)}>
            {pct.toFixed(2)}%
          </span>
        ) : null}
        {image.illustrative ? <ImageCredit position="bottom-left" /> : null}
      </div>
      {season ? <p className={cn("mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em]", toneText)}>{season}</p> : null}
      <Heading className={cn("min-h-[62px] text-[22px] font-semibold leading-[1.4] text-ink", season ? "mt-1" : "mt-5")}>{title}</Heading>
      {pct !== null ? <ProgressBar percent={pct} tone={tone} className="mt-5" label={`${title}: ${Math.round(pct)}% funded`} /> : null}
      <p className="mt-4 text-[15px] text-ink">
        {raised !== null ? <>Raised - {money(raised, currency)} </> : null}
        <span className={toneText}>Goal - {money(goal, currency)}</span>
      </p>
      <div className="mt-auto pt-6">
        <Button
          href={href}
          variant={flame && aa ? "flame-ink" : tone}
          size="sm"
          onClick={onCtaClick}
          aria-label={`${cta} to ${title}`}
        >
          {cta}
        </Button>
      </div>
    </article>
  );
}
