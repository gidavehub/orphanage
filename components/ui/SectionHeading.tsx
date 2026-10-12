import { cn } from "@/lib/cn";

type Tag = "h1" | "h2" | "h3";

/** Donat-style heading: Nunito ExtraBold, title case. Pass lines to control breaks. */
export function DonatHeading({
  lines,
  as: As = "h2",
  className,
  light,
  id,
}: {
  lines: string[];
  as?: Tag;
  className?: string;
  light?: boolean;
  id?: string;
}) {
  return (
    <As
      id={id}
      className={cn(
        "text-balance font-sans text-[32px] font-extrabold leading-[1.18] tracking-[-0.01em] md:text-[42px] xl:text-[50px]",
        light ? "text-white" : "text-ink",
        className,
      )}
    >
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </As>
  );
}

/**
 * Voices United heading: Anton, uppercase, one coral accent word.
 * `parts` alternates plain / accent starting with plain, e.g. ["Our", "Impact", "in Action"].
 */
export function VuHeading({
  parts,
  as: As = "h2",
  className,
  accentClass = "text-coral",
  id,
}: {
  parts: string[];
  as?: Tag;
  className?: string;
  accentClass?: string;
  id?: string;
}) {
  return (
    <As
      id={id}
      className={cn(
        "font-display text-[44px] uppercase leading-[0.98] tracking-[0.005em] md:text-[64px] xl:text-[76px]",
        className,
      )}
    >
      {parts.map((p, i) => (
        <span key={i} className={cn(i % 2 === 1 && accentClass)}>
          {p}
          {i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </As>
  );
}
