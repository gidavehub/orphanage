import Image from "next/image";
import { Plus } from "lucide-react";
import { SocialIcon } from "@/components/art/SocialIcons";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type PersonSocial = { icon: string; href: string; label?: string };

export type PersonCardProps = {
  name: string;
  role: string;
  image: UiImage;
  /** Up to four profiles fan out of the ＋ disc on hover or focus. */
  socials?: PersonSocial[];
  /** A slot under the role (e.g. a "Read bio" button that opens a Sheet). */
  action?: React.ReactNode;
  headingLevel?: 2 | 3;
  sizes?: string;
  className?: string;
};

// Fan-out positions for up to four profiles.
const FAN = [
  { x: -46, y: -30 },
  { x: -18, y: -52 },
  { x: 18, y: -52 },
  { x: 46, y: -30 },
];

/**
 * The landing Team arch card (design-system §3.7): mint card, arched portrait, a ＋ disc whose social
 * links fan out on hover or keyboard focus, and the card turning deep. Staff only.
 */
export function PersonCard({ name, role, image, socials = [], action, headingLevel = 3, sizes = "(min-width:1280px) 280px, 60vw", className }: PersonCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const fan = socials.slice(0, FAN.length);
  return (
    <article
      tabIndex={fan.length ? undefined : 0}
      className={cn(
        "group relative rounded-panel bg-mint px-5 pb-8 pt-0 text-center transition-colors duration-500 hover:bg-deep focus:bg-deep focus:outline-none focus-within:bg-deep",
        className,
      )}
    >
      <div className="relative mx-auto -mt-4 aspect-[265/235] w-full overflow-hidden rounded-b-[16px] rounded-t-[140px] bg-portrait">
        <Image
          src={image.src}
          alt={image.decorative ? "" : image.alt || `${name}, ${role}`}
          fill
          sizes={sizes}
          className="object-cover object-top transition-transform duration-700 ease-out-expo group-hover:scale-105"
        />
      </div>

      {/* ＋ disc with social fan-out */}
      <div className="relative mx-auto -mt-5 size-10">
        {fan.map((f, i) => (
          <a
            key={`${f.icon}-${i}`}
            href={f.href}
            target={f.href.startsWith("http") ? "_blank" : undefined}
            rel={f.href.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={f.label ?? `${name} on ${f.icon}`}
            className="absolute left-0 top-0 grid size-10 scale-50 place-items-center rounded-full bg-white text-deep opacity-0 shadow-md transition-all duration-500 ease-out-back hover:bg-marigold hover:text-night focus-visible:scale-100 focus-visible:opacity-100 group-hover:translate-x-(--fx) group-hover:translate-y-(--fy) group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-x-(--fx) group-focus-within:translate-y-(--fy) group-focus-within:scale-100 group-focus-within:opacity-100"
            style={{ ["--fx" as string]: `${FAN[i].x}px`, ["--fy" as string]: `${FAN[i].y}px`, transitionDelay: `${i * 50}ms` }}
          >
            <SocialIcon name={f.icon} className="size-4" />
          </a>
        ))}
        <span
          aria-hidden
          className="relative grid size-10 place-items-center rounded-full bg-forest text-white ring-4 ring-mint transition-all duration-500 group-hover:rotate-45 group-hover:bg-marigold group-hover:ring-deep group-focus:rotate-45 group-focus:bg-marigold group-focus:ring-deep group-focus-within:rotate-45 group-focus-within:bg-marigold group-focus-within:ring-deep"
        >
          <Plus strokeWidth={3} className="size-5" />
        </span>
      </div>

      <Heading className="mt-4 text-[22px] font-semibold text-ink transition-colors duration-500 group-hover:text-white group-focus:text-white group-focus-within:text-white">
        {name}
      </Heading>
      <p className="mt-1 text-[14px] text-body transition-colors duration-500 group-hover:text-marigold group-focus:text-marigold group-focus-within:text-marigold">
        {role}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
