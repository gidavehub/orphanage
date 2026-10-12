import { Eyebrow } from "./Eyebrow";
import { DonatHeading, VuHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/cn";

export type SectionIntroProps = {
  /** `donat` (default voice): Caveat eyebrow + Nunito heading. `vu`: Anton heading with one accent word + Inter lead. */
  voice?: "donat" | "vu";
  eyebrow?: string;
  /** donat: one entry per line. vu: alternating plain / ACCENT / plain parts (VuHeading). */
  title: string[];
  intro?: React.ReactNode;
  align?: "center" | "left";
  /** On a dark or photo surface: white text, brand marigold eyebrow. */
  light?: boolean;
  /** Heading id; point the Section's `labelledBy` at it. */
  id: string;
  as?: "h1" | "h2" | "h3";
  /** VU accent colour. Defaults to coral-800 on light surfaces (AA on vu-cream) and marigold on dark. */
  accentClass?: string;
  /** Up to two Buttons under the intro. */
  actions?: React.ReactNode;
  /** Fade-and-rise on scroll (default true). Never wrap above-the-fold intros: pass false. */
  reveal?: boolean;
  className?: string;
};

/**
 * Eyebrow + heading + lead, the block every landing section repeats (design-system §3.1).
 * The intro gap is `mt-4`; the caller adds the content gap (`mt-10` forms, `mt-14` grids).
 */
export function SectionIntro({
  voice = "donat",
  eyebrow,
  title,
  intro,
  align = "center",
  light,
  id,
  as = "h2",
  accentClass,
  actions,
  reveal = true,
  className,
}: SectionIntroProps) {
  const center = align === "center";
  const content = (
    <>
      {voice === "donat" ? (
        <>
          {eyebrow ? (
            <Eyebrow lines={center ? "both" : "right"} tone={light ? "brand" : "ink"}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <DonatHeading as={as} id={id} lines={title} light={light} className={cn(eyebrow && "mt-4")} />
        </>
      ) : (
        <>
          {eyebrow ? (
            <p className={cn("font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em]", light ? "text-white/85" : "text-ink/75")}>{eyebrow}</p>
          ) : null}
          <VuHeading
            as={as}
            id={id}
            parts={title}
            accentClass={accentClass ?? (light ? "text-marigold" : "text-coral-800")}
            className={cn(light ? "text-white" : "text-ink", eyebrow && "mt-3")}
          />
        </>
      )}
      {intro ? (
        <div
          className={cn(
            "mt-4 max-w-[600px] text-[16px]",
            center && "mx-auto",
            voice === "donat" ? "leading-[1.75]" : "font-grotesk leading-relaxed",
            light ? "text-white/90" : voice === "donat" ? "text-body" : "text-ink/75",
          )}
        >
          {intro}
        </div>
      ) : null}
      {actions ? <div className={cn("mt-8 flex flex-wrap gap-3", center && "justify-center")}>{actions}</div> : null}
    </>
  );

  const cls = cn(center ? "text-center" : "text-left", className);
  return reveal ? <Reveal className={cls}>{content}</Reveal> : <div className={cls}>{content}</div>;
}
