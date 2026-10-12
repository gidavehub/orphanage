"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { anchorOffset } from "@/components/ui/AnchorLink";
import { ScrollTrigger } from "./gsap";
import { useLenis } from "./SmoothScroll";

/**
 * Keeps Lenis in step with Next's own scroll handling on route changes (public-pages §2.2, §5.4;
 * design-system §4.1). Without it Lenis's internal target lags behind and the page jumps on the next
 * wheel event. Rendered once by `app/(site)/layout.tsx` inside `<Suspense fallback={null}>` (D4).
 *
 * - A new page (link click): scroll to its `#hash` target with the sticky-header offset, or to the top.
 * - Back or forward: Next restores the old position; Lenis is synced to it rather than reset.
 * - Then, one frame later (after `cv-auto` sections have measured), Lenis re-measures and
 *   ScrollTrigger refreshes, so GSAP pins rebuild against the new page.
 * Without Lenis (reduced motion) the browser's native behaviour and `scroll-padding-top` apply.
 */
export function RouteScrollReset() {
  const pathname = usePathname();
  const lenis = useLenis();
  const last = useRef(pathname);
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const fromHistory = popped.current;
    popped.current = false;

    let outer = 0;
    let inner = 0;
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        const target = hash ? document.getElementById(hash) : null;
        if (lenis) {
          lenis.resize();
          if (fromHistory) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
          else if (target) lenis.scrollTo(target, { immediate: true, force: true, offset: -anchorOffset() });
          else lenis.scrollTo(0, { immediate: true, force: true });
        } else if (target && !fromHistory) {
          target.scrollIntoView({ block: "start" });
        }
        ScrollTrigger.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pathname, lenis]);

  return null;
}
