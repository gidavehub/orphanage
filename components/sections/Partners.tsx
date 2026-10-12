import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  PartnerCareAlliance,
  PartnerCarepoint,
  PartnerGlobalHealth,
  PartnerKidsFirst,
  PartnerSchoolsTrust,
} from "@/components/art/PartnerLogos";
import { Brush } from "@/components/art/Brush";
import { Reveal } from "@/components/ui/Reveal";
import type { HomeView, PartnerView } from "@/lib/content/types";
import { routes } from "@/lib/routes";

type BuiltinKey = Extract<PartnerView["logo"], { kind: "builtin" }>["key"];

// The five placeholder badges by key (content/seed/partners.ts → `logo: { builtin }`).
const BUILTIN: Record<BuiltinKey, (p: { className?: string }) => React.ReactNode> = {
  "care-alliance": PartnerCareAlliance,
  "kids-first": PartnerKidsFirst,
  "schools-trust": PartnerSchoolsTrust,
  "global-health": PartnerGlobalHealth,
  carepoint: PartnerCarepoint,
};

/** One partner badge: a built-in placeholder SVG or an uploaded logo, linked when the partner has a site. */
function PartnerLogo({ partner, className }: { partner: PartnerView; className: string }) {
  const { logo } = partner;
  let art: React.ReactNode;
  if (logo.kind === "builtin") {
    const Logo = BUILTIN[logo.key];
    art = <Logo className={className} />;
  } else {
    art = (
      <Image
        src={logo.image.src}
        alt={partner.name}
        width={logo.image.width ?? 240}
        height={logo.image.height ?? 70}
        sizes="240px"
        className={`${className} object-contain`}
      />
    );
  }
  if (!partner.url) return art;
  return (
    <a href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={`${partner.name} (opens in a new tab)`} className="block">
      {art}
    </a>
  );
}

/** Donat "Trusted by over 90K+" strip with a torn-paper bottom edge (+ mobile marquee).
 *  Sits right under the hero and flags ribbon (client brief: trust first), on the same paper. */
export function Partners({ partners }: { partners: HomeView["partners"] }) {
  const [a, n, b] = partners.title;
  const logos = partners.logos;
  return (
    <section aria-labelledby="partners-title" className="paper relative pb-2 cv-auto">
      <div className="wrap-wide">
        <div className="relative mx-auto max-w-[1440px] bg-cream px-6 pb-12 pt-12 lg:mx-[6%]">
          <Reveal className="relative z-10">
            <h2 id="partners-title" className="text-center text-[22px] font-semibold text-ink md:text-[28px]">
              {a} <span className="text-marigold">{n}</span> {b}
            </h2>
            <p className="mt-2 text-center text-[15px] text-body">
              {partners.subline}{" "}
              <Link
                href={routes.partner()}
                className="group ml-1 inline-flex items-center gap-1 font-bold text-forest underline decoration-marigold/70 decoration-2 underline-offset-4 transition-colors hover:text-ink"
              >
                Become a Partner
                <ArrowUpRight aria-hidden strokeWidth={2.5} className="size-4 text-marigold-ink transition-transform duration-300 group-hover:rotate-45" />
              </Link>
            </p>
          </Reveal>

          {/* Desktop (≥1024): Donat's static row */}
          <Reveal stagger={0.08} className="relative z-10 mt-9 hidden items-center justify-around gap-8 text-[#5b5a55] lg:flex">
            {logos.map((p) => (
              <div key={p.id} className="opacity-80 grayscale transition-all duration-500 hover:-translate-y-1 hover:text-forest hover:opacity-100">
                <PartnerLogo partner={p} className="h-[70px] w-auto" />
              </div>
            ))}
          </Reveal>

          {/* Below 1024: our own twist — a slow marquee */}
          <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] lg:hidden">
            <div className="flex w-max animate-marquee gap-10 text-[#5b5a55]">
              {[...logos, ...logos].map((p, i) => (
                <div key={`${p.id}-${i}`} aria-hidden={i >= logos.length || undefined} className="flex shrink-0">
                  <PartnerLogo partner={p} className="h-[56px] w-auto shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Torn-paper bottom edge: the traced band, squashed and flipped so its ragged edge hangs down */}
          <Brush name="band" color="var(--color-cream)" flipY className="absolute inset-x-0 top-full w-full -translate-y-[58%]" style={{ aspectRatio: "1400 / 120" }} />
        </div>
      </div>
    </section>
  );
}
