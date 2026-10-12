"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cheap viewport detection (one IntersectionObserver, no scroll listeners or
 * forced layout). `once` stops observing after the first hit.
 */
export function useInView<T extends Element>({
  rootMargin = "0px 0px -12% 0px",
  once = true,
}: { rootMargin?: string; once?: boolean } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, once]);

  return [ref, inView] as const;
}
