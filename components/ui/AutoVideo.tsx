"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";

type Props = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "autoPlay" | "muted" | "loop" | "preload"> & {
  src: string;
  poster?: string;
  /** Force-pause (e.g. an inactive slide) regardless of visibility. */
  paused?: boolean;
};

/** Resolves once the page has loaded and the browser is idle, so clips never compete with the first paint. */
let settled: Promise<void> | null = null;
function pageSettled(): Promise<void> {
  settled ??= new Promise<void>((resolve) => {
    const idle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(() => resolve(), { timeout: 2500 }) : setTimeout(resolve, 600));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
  return settled;
}

/** Save-Data or a 2G connection: keep the poster, skip the clip. */
function lightData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
}

/**
 * Muted background video that only downloads/plays while on screen.
 * Keeps the page light: off-screen clips are paused, and nothing loads until
 * the element is within ~one viewport of the scroll position, the page has finished loading, and
 * the connection isn't on Save-Data or 2G.
 */
export const AutoVideo = forwardRef<HTMLVideoElement, Props>(function AutoVideo({ src, poster, paused, ...rest }, fwd) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const [near, setNear] = useState(false);
  const reduce = useReducedMotion();
  useImperativeHandle(fwd, () => ref.current as HTMLVideoElement);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let live = true;
    const sync = () => {
      if (visible.current && !paused && !reduce) {
        if (v.src) {
          v.play().catch(() => {});
          return;
        }
        if (lightData()) return;
        void pageSettled().then(() => {
          if (!live || !visible.current || paused || reduce) return;
          if (!v.src) v.src = src;
          v.play().catch(() => {});
        });
      } else v.pause();
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (e.isIntersecting) setNear(true);
        sync();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(v);
    sync();
    return () => {
      live = false;
      io.disconnect();
      // A route hidden by Activity keeps its DOM (display: none does not stop media), so the
      // cleanup must pause; the effect re-runs and resumes when the route is shown (next16 §2.2 item 6).
      v.pause();
    };
  }, [src, paused, reduce]);

  // Posters download eagerly in browsers, so attach them only once the clip is close.
  return <video ref={ref} poster={near ? poster : undefined} muted loop playsInline preload="none" {...rest} />;
});
