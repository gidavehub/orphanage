import Image from "next/image";
import Link from "next/link";
import { maskStyle } from "@/components/art/Brush";
import { ImageCredit } from "../ImageCredit";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type ProjectCardProps = {
  title: string;
  subtitle: string;
  image: UiImage;
  /** The project page; the whole tile becomes the link. */
  href?: string;
  sizes?: string;
  /** `aa` (default): night words on the marigold label. `landing`: the approved white-on-marigold pairing (home only). */
  contrast?: "aa" | "landing";
  className?: string;
};

/**
 * The landing "Our Recent Project" tile (design-system §3.7): a square photo that goes grayscale on
 * hover or focus while a marigold brush label paints in from the left with the title.
 */
export function ProjectCard({ title, subtitle, image, href, sizes = "(min-width:768px) 33vw, 100vw", contrast = "aa", className }: ProjectCardProps) {
  const landing = contrast === "landing";
  const cls = cn("group relative block aspect-square overflow-hidden rounded-card outline-none focus-visible:ring-4 focus-visible:ring-marigold", className);
  const body = (
    <>
      <Image
        src={image.src}
        alt=""
        fill
        sizes={sizes}
        style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
        className="object-cover transition-[filter,transform] duration-700 ease-out-expo group-hover:scale-105 group-hover:grayscale group-focus:grayscale"
      />
      {image.illustrative ? <ImageCredit position="top-left" /> : null}
      {/* Brush label: traced paint swipe, wiped in from the left */}
      <div className="absolute bottom-7 left-0 w-[88%] [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-700 ease-out-expo group-hover:[clip-path:inset(0_0_0_0)] group-focus:[clip-path:inset(0_0_0_0)]">
        <div className="relative px-6 py-5">
          <div aria-hidden className="absolute inset-0 bg-marigold" style={maskStyle("label")} />
          <p className={cn("relative text-[22px] font-bold", landing ? "text-white" : "text-night")}>{title}</p>
          <p className={cn("relative text-[13px]", landing ? "text-white/90" : "text-night/85")}>{subtitle}</p>
        </div>
      </div>
      <span className="sr-only">
        {title}: {subtitle}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={`${title}: ${subtitle}`}>
        {body}
      </Link>
    );
  }
  return (
    <article tabIndex={0} className={cls}>
      {body}
    </article>
  );
}
