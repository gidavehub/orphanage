"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type Lenis from "lenis";
import { prefersReducedMotion } from "./useReducedMotion";
import { isStudioDocument } from "./useStudioMode";

const LenisContext = createContext<Lenis | null>(null);

/** Access the page-wide Lenis instance (null when reduced motion is on, and until it has started). */
export function useLenis() {
  return useContext(LenisContext);
}

/** Runs `fn` once the page has loaded and the browser is idle. Returns a cancel function. */
function whenSettled(fn: () => void): () => void {
  let idleId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const idle = () => {
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(fn, { timeout: 2500 });
    else timer = setTimeout(fn, 400);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
  return () => {
    window.removeEventListener("load", idle);
    if (idleId !== null) window.cancelIdleCallback(idleId);
    if (timer) clearTimeout(timer);
  };
}

/**
 * Lenis smooth scrolling, synced to GSAP's ticker and ScrollTrigger. Both libraries load only after
 * the page has loaded and gone idle (dynamic imports), so they never compete with the first paint;
 * until then the page scrolls natively. Pages with scroll-scrubbed sections load GSAP themselves.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    let cancelled = false;
    let teardown = () => {};

    const cancelWait = whenSettled(() => {
      void Promise.all([import("lenis"), import("./gsap")]).then(([{ default: LenisCtor }, { gsap, ScrollTrigger }]) => {
        if (cancelled) return;

        // Pin/scrub positions shift when webfonts land or when a `cv-auto` section swaps its
        // estimated height for its real one — re-measure (debounced) when either happens.
        let t: ReturnType<typeof setTimeout>;
        const refresh = () => {
          clearTimeout(t);
          t = setTimeout(() => {
            // Never re-measure mid-pin (it can jump); try again once the pin releases.
            if (ScrollTrigger.getAll().some((st) => st.pin && st.isActive)) refresh();
            else ScrollTrigger.refresh();
          }, 150);
        };
        document.fonts?.ready.then(refresh);
        document.addEventListener("contentvisibilityautostatechange", refresh, true);

        // Native scrolling in the reduced-motion case and inside the website studio's preview.
        let instance: Lenis | null = null;
        let tick: ((time: number) => void) | null = null;
        if (!prefersReducedMotion() && !isStudioDocument()) {
          const created = new LenisCtor({
            duration: 1.15,
            easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)),
            smoothWheel: true,
          });
          created.on("scroll", ScrollTrigger.update);
          const onTick = (time: number) => created.raf(time * 1000);
          gsap.ticker.add(onTick);
          gsap.ticker.lagSmoothing(0);
          instance = created;
          tick = onTick;
          setLenis(created);
          if (process.env.NODE_ENV !== "production") (window as unknown as { __lenis?: Lenis }).__lenis = created;
        }

        teardown = () => {
          clearTimeout(t);
          document.removeEventListener("contentvisibilityautostatechange", refresh, true);
          if (tick) gsap.ticker.remove(tick);
          instance?.destroy();
          setLenis(null);
        };
      });
    });

    return () => {
      cancelled = true;
      cancelWait();
      teardown();
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
