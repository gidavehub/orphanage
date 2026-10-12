/**
 * Per-word rise (the landing hero's `hero-rise`, 70ms stagger), extracted verbatim from Hero.tsx
 * (design-system §3.2). CSS only, so it is safe above the fold; still under reduced motion.
 */
export function RiseWords({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-top">
          <span
            className="inline-block animate-[hero-rise_1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={{ animationDelay: `${delay + i * 70}ms` }}
          >
            {w}&nbsp;
          </span>
        </span>
      ))}
    </>
  );
}
