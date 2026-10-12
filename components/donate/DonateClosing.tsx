"use client";

import { Heart } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { scrollToId } from "@/components/ui/AnchorLink";
import { ShareRow } from "@/components/ui/ShareRow";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { useDonateContext } from "./DonateStateProvider";

/**
 * The donate page's closing chapter (its one Voices United moment, PLAN D121): a vu-cream band with
 * the giant Anton promise (coral-800 accent for AA on cream), a "Give now" button back to the widget
 * and the share row for the cause the donor is looking at.
 */
export function DonateClosing({ eyebrow, title, text, shareTitle }: { eyebrow?: string; title: string[]; text?: string; shareTitle: string }) {
  const ctx = useDonateContext();
  const lenis = useLenis();
  const cause = ctx ? ctx.bySlug.get(ctx.activeSlug) : undefined;

  return (
    <section aria-labelledby="donate-closing-title" className="relative overflow-hidden bg-vu-cream pb-28 pt-20 md:pb-36 md:pt-28">
      <Brush name="splash" color="var(--color-coral)" className="absolute -right-24 -top-24 w-[340px] opacity-[0.12] md:w-[460px]" rotate={-14} />
      <Brush name="strokes" color="var(--color-marigold)" className="absolute -bottom-10 -left-16 hidden w-[260px] opacity-25 md:block" rotate={24} />
      <div className="wrap relative text-center">
        {eyebrow ? <p className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.12em] text-ink/70">{eyebrow}</p> : null}
        <h2 id="donate-closing-title" className="mx-auto mt-4 max-w-[980px] font-display text-[40px] uppercase leading-[1] tracking-[0.005em] text-ink sm:text-[56px] md:text-[72px]">
          {title.map((line, i) => (
            <span key={i} className={i % 2 === 1 ? "block text-coral-800" : "block"}>
              {line}
            </span>
          ))}
        </h2>
        {text ? <p className="mx-auto mt-6 max-w-[560px] font-grotesk text-[16px] leading-relaxed text-ink/75 md:text-[17px]">{text}</p> : null}
        <div className="mt-9 flex flex-col items-center gap-6">
          <button
            type="button"
            onClick={() => scrollToId("donate-widget", lenis)}
            className="inline-flex h-14 items-center gap-2.5 rounded-full bg-coral-800 px-9 font-grotesk text-[14px] font-medium uppercase tracking-[0.03em] text-white transition-colors duration-300 hover:bg-night"
          >
            <Heart aria-hidden className="size-4" fill="currentColor" strokeWidth={0} /> Give now
          </button>
          <ShareRow url={cause?.href ?? "/donate"} title={cause && cause.kind !== "general" ? cause.title : "Give to Haven"} label={shareTitle} className="justify-center" />
        </div>
      </div>
    </section>
  );
}
