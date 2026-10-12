import type { ProgrammeId } from "@/lib/model/enums";

/** The six programme glyphs, one per programme id. */
export type ProgrammeIconName = ProgrammeId;
import { cn } from "@/lib/cn";

// Duotone illustrated icons in Donat's style (flat fills + dark outline).
// Hover animations run when an ancestor has the `group` class (see globals.css `pi-*`).

const O = "var(--color-deep)"; // outline
const SW = 2.2;
const common = { stroke: O, strokeWidth: SW, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Protection() {
  return (
    <>
      <g className="pi-part pi-pulse">
        <path {...common} fill="var(--color-forest)" d="M32 6L52 13V30C52 43 43 52 32 58C21 52 12 43 12 30V13Z" />
        <path fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" d="M32 11.5L47 17V30C47 40 40.5 47 32 52" strokeLinecap="round" />
      </g>
      <g className="pi-part pi-beat">
        <path {...common} fill="var(--color-marigold)" d="M32 42C25 37 20.5 33 20.5 27.5C20.5 24 23 21.5 26.2 21.5C28.8 21.5 30.8 23 32 25.2C33.2 23 35.2 21.5 37.8 21.5C41 21.5 43.5 24 43.5 27.5C43.5 33 39 37 32 42Z" />
      </g>
    </>
  );
}

function Education() {
  return (
    <g className="pi-part pi-tilt">
      <path {...common} fill="var(--color-deep)" d="M18 30V41C18 45 25 48 32 48C39 48 46 45 46 41V30" />
      <path {...common} fill="var(--color-forest)" d="M32 14L59 25L32 36L5 25Z" />
      <path fill="#fff" fillOpacity=".25" d="M32 17.5L50 25L32 32.5Z" />
      <g className="pi-part pi-swing" style={{ transformOrigin: "32px 25px" }}>
        <path fill="none" stroke="var(--color-marigold)" strokeWidth="2.6" strokeLinecap="round" d="M32 25L49 31V45" />
        <path {...common} fill="var(--color-marigold)" d="M46 44H52L53.5 53H44.5Z" />
      </g>
      <circle cx="32" cy="25" r="2.6" fill="var(--color-marigold)" stroke={O} strokeWidth="1.6" />
    </g>
  );
}

function Medical() {
  return (
    <>
      <g className="pi-part pi-shake">
        <rect {...common} x="17" y="6" width="24" height="9" rx="2.5" fill="var(--color-deep)" />
        <path {...common} fill="var(--color-marigold)" d="M19 15H39V19C43 21 45 25 45 29V53C45 56 43 58 40 58H18C15 58 13 56 13 53V29C13 25 15 21 19 19Z" />
        <rect {...common} x="17" y="30" width="24" height="16" rx="3" fill="#fff" />
        <path d="M29 33V43M24 38H34" stroke="var(--color-forest)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="pi-part pi-roll" style={{ transformOrigin: "50px 49px" }}>
        <g transform="rotate(-38 50 49)">
          <rect {...common} x="40" y="43" width="20" height="12" rx="6" fill="#fff" />
          <path {...common} fill="var(--color-forest)" d="M50 43H54C57.3 43 60 45.7 60 49C60 52.3 57.3 55 54 55H50Z" />
        </g>
      </g>
    </>
  );
}

function Psychological() {
  return (
    <>
      <g className="pi-part pi-bob-slow">
        <path {...common} fill="var(--color-forest)" d="M40 8H56C58.2 8 60 9.8 60 12V22C60 24.2 58.2 26 56 26H52L47 31V26H40C37.8 26 36 24.2 36 22V12C36 9.8 37.8 8 40 8Z" />
        <circle cx="42.5" cy="17" r="1.7" fill="#fff" />
        <circle cx="48" cy="17" r="1.7" fill="#fff" />
        <circle cx="53.5" cy="17" r="1.7" fill="#fff" />
      </g>
      <g className="pi-part pi-bob">
        <path {...common} fill="#fff" d="M10 18H38C41.3 18 44 20.7 44 24V42C44 45.3 41.3 48 38 48H22L13 56V48H10C6.7 48 4 45.3 4 42V24C4 20.7 6.7 18 10 18Z" />
        <g className="pi-part pi-pop" style={{ transformOrigin: "24px 33px" }}>
          <path fill="var(--color-marigold)" stroke={O} strokeWidth="1.8" strokeLinejoin="round" d="M24 42C18.5 38 15 35 15 30.8C15 28 17 26 19.6 26C21.6 26 23.1 27.2 24 28.9C24.9 27.2 26.4 26 28.4 26C31 26 33 28 33 30.8C33 35 29.5 38 24 42Z" />
        </g>
      </g>
    </>
  );
}

function Legal() {
  return (
    <>
      <path {...common} fill="var(--color-forest)" d="M20 58H44L41 51H23Z" />
      <path {...common} fill="var(--color-deep)" d="M30 16H34V51H30Z" />
      <circle {...common} cx="32" cy="12" r="4" fill="var(--color-marigold)" />
      <g className="pi-part pi-balance" style={{ transformOrigin: "32px 18px" }}>
        <path {...common} fill="none" d="M9 19H55" />
        <g className="pi-part pi-counter-l" style={{ transformOrigin: "11px 19px" }}>
          <path fill="none" stroke={O} strokeWidth="1.6" d="M11 19L4 35M11 19L18 35" />
          <path {...common} fill="var(--color-marigold)" d="M2 35H20C20 40 16 43 11 43C6 43 2 40 2 35Z" />
        </g>
        <g className="pi-part pi-counter-r" style={{ transformOrigin: "53px 19px" }}>
          <path fill="none" stroke={O} strokeWidth="1.6" d="M53 19L46 35M53 19L60 35" />
          <path {...common} fill="var(--color-marigold)" d="M44 35H62C62 40 58 43 53 43C48 43 44 40 44 35Z" />
        </g>
      </g>
    </>
  );
}

function Family() {
  return (
    <>
      <path {...common} fill="var(--color-marigold)" d="M12 28H52V56H12Z" />
      <g className="pi-part pi-lift">
        <path {...common} fill="var(--color-forest)" d="M6 30L32 8L58 30C59 31 58 33 56.5 33C56 33 55.5 32.8 55 32.4L32 13.5L9 32.4C8.5 32.8 8 33 7.5 33C6 33 5 31 6 30Z" />
        <rect {...common} x="43" y="10" width="7" height="12" fill="var(--color-deep)" />
      </g>
      <path {...common} fill="#fff" d="M25 56V42C25 38.7 28.1 36 32 36C35.9 36 39 38.7 39 42V56Z" />
      <g className="pi-part pi-beat" style={{ transformOrigin: "32px 46px" }}>
        <path fill="var(--color-flame)" d="M32 50.5C29 48.3 27 46.6 27 44.3C27 42.8 28.1 41.7 29.5 41.7C30.6 41.7 31.5 42.3 32 43.2C32.5 42.3 33.4 41.7 34.5 41.7C35.9 41.7 37 42.8 37 44.3C37 46.6 35 48.3 32 50.5Z" />
      </g>
    </>
  );
}

const ICONS: Record<ProgrammeIconName, () => React.ReactElement> = {
  protection: Protection,
  education: Education,
  medical: Medical,
  psychological: Psychological,
  legal: Legal,
  family: Family,
};

export function ProgrammeIcon({ name, className }: { name: ProgrammeIconName; className?: string }) {
  const Icon = ICONS[name];
  return (
    <svg viewBox="0 0 64 64" className={cn("programme-icon overflow-visible", className)} aria-hidden>
      <Icon />
    </svg>
  );
}
