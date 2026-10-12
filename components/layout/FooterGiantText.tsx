"use client";

import { useInView } from "@/lib/motion/useInView";

/** VU footer: a giant faded statement line whose words rise as the footer arrives. */
export function FooterGiantText({ text }: { text: string }) {
  const [ref, inView] = useInView<HTMLParagraphElement>({ rootMargin: "0px 0px -5% 0px" });
  return (
    <p
      ref={ref}
      data-rise=""
      data-shown={inView ? "" : undefined}
      aria-hidden
      className="select-none overflow-hidden whitespace-nowrap text-center font-display text-[5.6vw] uppercase leading-[1.05] text-white/[0.07] xl:text-[76px]"
    >
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span className="inline-block" style={{ "--i": i } as React.CSSProperties}>
            {w}&nbsp;
          </span>
        </span>
      ))}
    </p>
  );
}
