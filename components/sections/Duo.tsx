import { Reveal } from "@/components/ui/Reveal";
import { ActionCard } from "@/components/ui/cards/ActionCard";
import type { HomeView } from "@/lib/content/types";

/** Donat "Become a volunteer / Join Us volunteer" cards, straddling white → cream. */
export function Duo({ duo }: { duo: HomeView["duo"] }) {
  return (
    <section id="involved" aria-label="Get involved" className="relative bg-[linear-gradient(180deg,#fff_0%,#fff_50%,var(--color-vu-cream)_50%)] pb-4 cv-auto">
      <Reveal stagger={0.15} className="wrap grid gap-6 md:grid-cols-2">
        {duo.map((c, i) => (
          <ActionCard
            key={c.title}
            title={c.title}
            text={c.text}
            cta={c.cta.label}
            href={c.cta.href}
            image={c.image}
            tone={c.tone}
            brushRotate={i === 0 ? 20 : -14}
            contrast="landing"
          />
        ))}
      </Reveal>
    </section>
  );
}
