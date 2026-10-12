import Image from "next/image";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { CoralBlob, CurlyArrow, GreenBlobHeart } from "@/components/art/Decor";
import type { HomeView } from "@/lib/content/types";
import { img } from "@/lib/media/pipeline";

// The levitating hand plates are art, not content: they stay in code (content-model §4.8).
const HANDS = [img("hand-left"), img("hand-right")] as const;

/**
 * Donat "Our Door Are Always Open" band: floating hands, looping arrows, blobs. Copy and the two
 * calls to action come from `home.doors`; the emergency line from `settings.safety`.
 */
export function DoorsOpen({ doors }: { doors: HomeView["doors"] }) {
  const [left, right] = HANDS;
  return (
    <section id="support" aria-labelledby="doors-title" className="relative isolate overflow-hidden bg-deep py-28 text-white md:py-36 cv-auto">
      <CoralBlob className="absolute -top-2 left-[3%] -z-10 w-[170px] md:w-[210px]" />
      <GreenBlobHeart className="absolute right-0 top-0 -z-10 w-[170px] md:w-[230px]" />

      {/* Levitating hands (keyed from Optiq plates) with hand-drawn arrows */}
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] left-0 -z-10 hidden w-[27%] max-w-[470px] md:block">
        <CurlyArrow className="absolute -top-[92%] left-[42%] w-[62%]" />
        <div className="animate-levitate">
          <Image src={left} alt="" width={1400} height={382} sizes="30vw" className="h-auto w-full drop-shadow-[0_30px_30px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-[8%] right-0 -z-10 hidden w-[27%] max-w-[470px] md:block">
        <CurlyArrow flip className="absolute -top-[88%] right-[40%] w-[62%]" />
        <div className="animate-levitate-slow [animation-delay:-2.5s]">
          <Image src={right} alt="" width={1400} height={428} sizes="30vw" className="h-auto w-full drop-shadow-[0_30px_30px_rgba(0,0,0,0.35)]" />
        </div>
      </div>

      <Reveal stagger={0.12} className="wrap relative flex flex-col items-center text-center">
        <h2 id="doors-title" className="max-w-[760px] text-balance text-[34px] font-extrabold leading-[1.2] md:text-[46px] xl:text-[52px]">
          {doors.title}
        </h2>
        <p className="mt-5 max-w-[600px] text-[16px] leading-[1.8] text-white/80">{doors.text}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Button href={doors.primaryCta.href} variant="marigold" size="lg">
            {doors.primaryCta.label}
          </Button>
          <Button href={doors.secondaryCta.href} variant="outline-light" size="lg" icon="none">
            <span className="inline-flex items-center gap-2">
              <ShieldAlert aria-hidden className="size-4" strokeWidth={2.5} /> {doors.secondaryCta.label}
            </span>
          </Button>
        </div>
        <p className="mt-8 flex max-w-[640px] items-start gap-2.5 rounded-2xl bg-white/[0.06] px-5 py-3.5 text-left text-[13.5px] leading-relaxed text-white/75">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold" />
          {doors.emergencyNotice}
        </p>
      </Reveal>
    </section>
  );
}
