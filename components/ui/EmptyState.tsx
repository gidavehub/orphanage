import { DoodleField, HeartCluster } from "@/components/art/Decor";
import { HandDoodle } from "@/components/art/Hands";
import { HEART_D } from "./glyphs";
import { cn } from "@/lib/cn";

export type EmptyStateArt = "hands" | "hearts" | "doodle" | "plane" | "sprig" | "house" | "heart";

export type EmptyStateProps = {
  title: string;
  /** A short Caveat line in marigold-ink ("Nothing waiting for you right now."). */
  note?: string;
  /** One or two plain sentences under the title. */
  body?: React.ReactNode;
  art?: EmptyStateArt | "none";
  /** One Button. */
  action?: React.ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Less vertical room (inside cards and sheets). */
  compact?: boolean;
  className?: string;
};

/* Pastel line doodles in the DoodleField spirit, drawn with brand tokens. */
function Doodle({ art }: { art: "plane" | "sprig" | "house" | "heart" }) {
  const common = { fill: "none", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (art) {
    case "plane":
      return (
        <svg viewBox="0 0 120 100" aria-hidden className="h-full w-full">
          <path {...common} stroke="var(--color-forest)" strokeOpacity={0.55} d="M14 52L104 16L80 86L58 62L14 52Z" />
          <path {...common} stroke="var(--color-forest)" strokeOpacity={0.55} d="M104 16L58 62L56 84L68 70" />
          <path {...common} stroke="var(--color-marigold)" strokeDasharray="2 9" d="M10 86C24 80 30 70 40 72" />
        </svg>
      );
    case "sprig":
      return (
        <svg viewBox="0 0 120 100" aria-hidden className="h-full w-full">
          <path {...common} stroke="var(--color-forest)" strokeOpacity={0.55} d="M60 94C62 70 64 44 60 10" />
          {[22, 40, 58].map((y, i) => (
            <g key={i} stroke="var(--color-forest)" strokeOpacity={0.55} {...common}>
              <ellipse cx={48} cy={y} rx={12} ry={5.5} transform={`rotate(-35 48 ${y})`} />
              <ellipse cx={72} cy={y + 9} rx={12} ry={5.5} transform={`rotate(35 72 ${y + 9})`} />
            </g>
          ))}
          <path d={HEART_D} transform="translate(92 20) scale(0.7)" fill="var(--color-marigold)" opacity={0.8} />
        </svg>
      );
    case "house":
      return (
        <svg viewBox="0 0 120 100" aria-hidden className="h-full w-full">
          <path {...common} stroke="var(--color-clay)" strokeOpacity={0.6} d="M16 50L60 14L104 50" />
          <path {...common} stroke="var(--color-forest)" strokeOpacity={0.55} d="M28 44V90H92V44" />
          <path d={HEART_D} transform="translate(60 62) scale(0.95)" fill="var(--color-marigold)" opacity={0.85} />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 120 100" aria-hidden className="h-full w-full">
          <path d={HEART_D} transform="translate(60 52) scale(2.6)" fill="var(--color-marigold)" opacity={0.85} />
          <path d={HEART_D} transform="translate(98 22) rotate(16) scale(0.9)" fill="var(--color-coral)" opacity={0.55} />
          <path d={HEART_D} transform="translate(20 28) rotate(-14) scale(0.7)" fill="var(--color-forest)" opacity={0.45} />
        </svg>
      );
  }
}

function Art({ art }: { art: EmptyStateArt }) {
  switch (art) {
    case "hands":
      return <HandDoodle className="h-full w-auto" />;
    case "hearts":
      return <HeartCluster className="h-full w-auto text-mist" />;
    case "doodle":
      return (
        <div className="h-full w-[180px] overflow-hidden">
          <DoodleField className="-ml-6 -mt-10 w-[300px]" />
        </div>
      );
    default:
      return <Doodle art={art} />;
  }
}

/** A calm "nothing here yet" panel with a doodle, a title, a Caveat note and one action (design-system §3.4). */
export function EmptyState({ title, note, body, art = "hands", action, headingLevel = 3, compact, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-10" : "py-16", className)}>
      {art !== "none" ? (
        <div aria-hidden className={cn("flex items-center justify-center", compact ? "h-[88px]" : "h-[120px]")}>
          <Art art={art} />
        </div>
      ) : null}
      <Heading className={cn("text-[22px] font-extrabold leading-tight text-ink", art !== "none" && "mt-6")}>{title}</Heading>
      {note ? <p className="mt-2 font-script text-[24px] font-bold leading-tight text-marigold-ink">{note}</p> : null}
      {body ? <div className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-body">{body}</div> : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
