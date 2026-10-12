"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { scrollToId } from "@/components/ui/AnchorLink";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { cn } from "@/lib/cn";
import { useDonateContext } from "./DonateStateProvider";
import { amountOf, feeOf, moneyExact } from "./model";

/**
 * Phones and tablets (< 1024px): a sticky bottom bar once the widget has scrolled out of view above
 * ("Donate USD 50 monthly", or "Choose an amount"), which scrolls back to it. Hidden while any form
 * field has focus, because the keyboard is open (public-pages §4.3).
 */
export function StickyGiveBar() {
  const ctx = useDonateContext();
  const lenis = useLenis();
  const [past, setPast] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // The widget renders after its Suspense boundary resolves, so wait for it to appear.
    let io: IntersectionObserver | null = null;
    let raf = 0;
    let tries = 0;
    const attach = () => {
      const el = document.getElementById("donate-widget");
      if (!el) {
        if (tries++ < 600) raf = window.requestAnimationFrame(attach);
        return;
      }
      io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.bottom < 0), { threshold: 0 });
      io.observe(el);
    };
    attach();
    return () => {
      window.cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input, textarea, select, [contenteditable='true']");
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  if (!ctx) return null;
  const { state, config } = ctx;
  const value = state.mode === "cash" ? amountOf(state) : 0;
  const total = state.coverFees ? value + feeOf(value, config.coverFeesPercent) : value;
  const label =
    state.mode === "in_kind"
      ? "Offer items"
      : total > 0
        ? `Donate ${moneyExact(total, state.currency)}${state.frequency === "one_time" ? "" : ` ${FREQUENCY_LABEL[state.frequency].toLowerCase()}`}`
        : "Choose an amount";
  const shown = past && !typing;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[90px] transition-[transform,opacity] duration-500 ease-out-expo motion-reduce:transition-none lg:hidden",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0",
      )}
      aria-hidden={!shown}
    >
      <button
        type="button"
        tabIndex={shown ? 0 : -1}
        onClick={() => scrollToId("donate-widget", lenis)}
        className="flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-coral-800 px-5 font-grotesk text-[14px] font-medium uppercase tracking-[0.02em] text-white shadow-float transition-colors hover:bg-night sm:gap-2.5 sm:text-[15px]"
      >
        <Heart aria-hidden className="size-4 animate-heartbeat motion-reduce:animate-none" fill="currentColor" strokeWidth={0} />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}
