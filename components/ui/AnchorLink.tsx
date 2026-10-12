"use client";

import { useLenis } from "@/lib/motion/SmoothScroll";
import { cn } from "@/lib/cn";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sticky-bar clearance, identical to the CSS `scroll-padding-top` (PLAN D124). */
export function anchorOffset(): number {
  if (typeof window === "undefined") return 84;
  return window.matchMedia("(min-width: 80rem)").matches ? 104 : 84;
}

/**
 * Scrolls to an element id through Lenis when it is running (public pages), natively otherwise,
 * then moves focus there without a second jump so keyboard and screen-reader users land with it.
 */
export function scrollToId(id: string, lenis?: ReturnType<typeof useLenis>): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = prefersReducedMotion();
  if (lenis) lenis.scrollTo(el, { offset: -anchorOffset(), immediate: reduce });
  else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  return true;
}

export type AnchorLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** The target id, with or without the leading "#". */
  to: string;
  children: React.ReactNode;
};

/**
 * A plain `<a href="#id">` that smooth-scrolls with Lenis using the sticky-header offset and
 * updates the URL hash. Without JS it is a native jump (public-pages §2.2).
 */
export function AnchorLink({ to, children, onClick, className, ...rest }: AnchorLinkProps) {
  const lenis = useLenis();
  const id = to.replace(/^#/, "");
  return (
    <a
      href={`#${id}`}
      className={cn(className)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (scrollToId(id, lenis)) {
          e.preventDefault();
          if (window.location.hash !== `#${id}`) window.history.pushState(window.history.state, "", `#${id}`);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
