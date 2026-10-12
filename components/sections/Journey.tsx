import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import type { HomeView } from "@/lib/content/types";
import { routes } from "@/lib/routes";

/** Voices United "What We Do": reveal-on-hover cards → how Haven reaches children, on earthy clay. */
export function Journey({ journey }: { journey: HomeView["journey"] }) {
  return (
    <section aria-labelledby="journey-title" className="bg-clay py-24 text-white md:py-32 cv-auto">
      <div className="wrap">
        <Reveal className="text-center">
          <h2 id="journey-title" className="font-display text-[44px] uppercase leading-none md:text-[64px] xl:text-[76px]">
            {journey.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] font-grotesk text-[16px] leading-relaxed text-white">{journey.text}</p>
        </Reveal>

        <Reveal stagger={0.12} y={50} className="mt-14 flex flex-wrap justify-center gap-4">
          {journey.steps.map((s, i) => (
            <article
              key={s.id}
              tabIndex={0}
              className="group relative isolate flex h-[380px] w-full flex-col sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] xl:w-[calc(20%-13px)] justify-end overflow-hidden rounded-[24px] bg-black/[0.09] p-6 outline-none ring-white/60 focus-visible:ring-2"
            >
              {/* Image reveal: clip opens upward on hover/focus */}
              <div className="absolute inset-0 -z-10 [clip-path:inset(100%_0_0_0_round_24px)] transition-[clip-path] duration-700 ease-out-expo group-hover:[clip-path:inset(0_0_0_0_round_24px)] group-focus:[clip-path:inset(0_0_0_0_round_24px)]">
                <Image
                  src={s.image.src}
                  alt=""
                  fill
                  sizes="(min-width:1280px) 20vw, (min-width:1024px) 33vw, 50vw"
                  style={s.image.objectPosition ? { objectPosition: s.image.objectPosition } : undefined}
                  className="scale-110 object-cover transition-transform duration-1000 ease-out-expo group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(6,21,18,0.88)_100%)]" />
                {/* Under the step number, so it only shows with the photo. */}
                {s.image.illustrative ? <ImageCredit position="static" className="absolute left-6 top-[76px]" /> : null}
              </div>
              <span aria-hidden className="absolute left-6 top-6 font-display text-[40px] leading-none text-white/25 transition-colors duration-500 group-hover:text-white/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/40 transition-all duration-500 group-hover:rotate-45 group-hover:bg-white group-hover:text-clay">
                <ArrowUpRight className="size-5" />
              </span>
              <h3 className="font-display text-[24px] leading-tight">{s.title}</h3>
              <p className="mt-3 font-grotesk text-[14px] leading-relaxed text-white">{s.text}</p>
            </article>
          ))}
        </Reveal>

        <div className="mt-12 flex justify-center">
          <Button href={routes.about("approach")} variant="vu-white" icon="none" size="lg" className="min-w-[200px]">
            How We Work
          </Button>
        </div>
      </div>
    </section>
  );
}
