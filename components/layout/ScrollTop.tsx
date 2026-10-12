"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { cn } from "@/lib/cn";

const R = 26;
const C = 2 * Math.PI * R;

/** Donat's scroll-to-top button with a scroll-progress ring. */
export function ScrollTop() {
  const ring = useRef<SVGCircleElement>(null);
  const [show, setShow] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (ring.current) ring.current.style.strokeDashoffset = String(C * (1 - p));
      setShow(window.scrollY > 600);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      data-scroll-top=""
      tabIndex={show ? undefined : -1}
      aria-hidden={show ? undefined : true}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (lenis) lenis.scrollTo(0, { duration: 1.6, immediate: reduce });
        else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        // Keyboard users land at the top of the page too (the header is id="top").
        document.getElementById("top")?.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
      }}
      className={cn(
        "group fixed bottom-6 right-6 z-50 grid size-[58px] place-items-center rounded-full bg-white text-forest shadow-[0_10px_30px_-10px_rgba(6,21,18,0.35)] transition-all duration-500 ease-out-expo",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r={R} fill="none" stroke="var(--color-mint)" strokeWidth="2.5" />
        <circle ref={ring} cx="30" cy="30" r={R} fill="none" stroke="var(--color-forest)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
      </svg>
      <ArrowUp className="relative size-5 transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={2.5} />
    </button>
  );
}
