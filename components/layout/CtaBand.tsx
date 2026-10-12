import Image from "next/image";
import { ShieldAlert } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { CoralBlob, CurlyArrow, GreenBlobHeart } from "@/components/art/Decor";
import { Button } from "@/components/ui/Button";
import { EMERGENCY_BODY } from "@/components/ui/Notice";
import { Reveal } from "@/components/ui/Reveal";
import type { UiImage } from "@/lib/model/ui";
import { routeHref } from "@/lib/routes";
import { cn } from "@/lib/cn";

export type CtaBandProps = {
  /**
   * `default`: the coral Voices United band (= FinalCta, D122): Anton heading and Donate Now /
   * Become a Volunteer / Request Support.
   * `safeguarding`: the DoorsOpen deep band: Request Support / Report a Concern and the emergency line.
   * `volunteer`: the deep band asking for time and partnership.
   */
  variant?: "default" | "safeguarding" | "volunteer";
  title?: string;
  text?: string;
  /** Replaces the variant's buttons (at most three). */
  actions?: React.ReactNode;
  /** The emergency sentence (settings.safety); the safeguarding variant always shows one. */
  emergencyNotice?: string | null;
  /** The two levitating hand plates of the deep variants (md and up): left, right. */
  hands?: [UiImage, UiImage];
  /** Heading id (default "cta-title"). */
  id?: string;
  /** Bottom room for the Footer's torn edge. CtaBand is normally the last section (default true). */
  last?: boolean;
  className?: string;
};

const COPY = {
  default: {
    title: "Your Support Will Positively Impact a Child's Welfare and Future.",
    text: "Give, volunteer or ask for help. Every step reaches a child in the communities we serve.",
  },
  safeguarding: {
    title: "Our Doors Are Always Open",
    text: "If you or a child you know needs help, tell us. Requests are confidential and read by trained staff.",
  },
  volunteer: {
    title: "Give Your Time, Skills or Partnership",
    text: "Teachers, counsellors, lawyers, nurses and organisers help us reach more families. Tell us what you can offer.",
  },
} as const;

function Hands({ hands }: { hands: [UiImage, UiImage] }) {
  const [left, right] = hands;
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] left-0 -z-10 hidden w-[27%] max-w-[470px] md:block">
        <CurlyArrow className="absolute -top-[92%] left-[42%] w-[62%]" />
        <div className="animate-levitate">
          <Image src={left.src} alt="" width={left.width ?? 1400} height={left.height ?? 382} sizes="30vw" className="h-auto w-full drop-shadow-[0_30px_30px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-[8%] right-0 -z-10 hidden w-[27%] max-w-[470px] md:block">
        <CurlyArrow flip className="absolute -top-[88%] right-[40%] w-[62%]" />
        <div className="animate-levitate-slow [animation-delay:-2.5s]">
          <Image src={right.src} alt="" width={right.width ?? 1400} height={right.height ?? 428} sizes="30vw" className="h-auto w-full drop-shadow-[0_30px_30px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
    </>
  );
}

/**
 * The closing band before the Footer (design-system §3.1, PLAN D122). Never after a sensitive form.
 * Deep into the Footer's night reads as one dark mass; coral is the VU closing call.
 */
export function CtaBand({ variant = "default", title, text, actions, emergencyNotice, hands, id = "cta-title", last = true, className }: CtaBandProps) {
  const copy = COPY[variant];
  const heading = title ?? copy.title;
  const body = text ?? copy.text;
  const lastPad = last ? "pb-[max(9rem,12vw)] md:pb-[max(9rem,12vw)]" : "";

  if (variant === "default") {
    return (
      <section aria-labelledby={id} className={cn("relative isolate overflow-hidden bg-coral pt-24 text-white [--focus:var(--color-night)] md:pt-28", last ? lastPad : "pb-24 md:pb-28", className)}>
        <Brush name="splash" color="var(--color-flame)" rotate={-12} className="absolute -left-24 -top-24 -z-10 w-[340px] opacity-60 md:w-[460px]" />
        <Brush name="splash" color="var(--color-coral-800)" rotate={160} className="absolute -bottom-10 -right-28 -z-10 w-[300px] opacity-40 md:w-[420px]" />
        <Reveal className="wrap flex flex-col items-center text-center">
          <h2 id={id} className="max-w-[980px] text-balance font-display text-[40px] uppercase leading-[1.02] tracking-[0.005em] md:text-[58px] xl:text-[68px]">
            {heading}
          </h2>
          {body ? <p className="mt-5 max-w-[600px] font-grotesk text-[16px] leading-relaxed text-night md:text-[17px]">{body}</p> : null}
          <div className="mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
            {actions ?? (
              <>
                <Button href={routeHref("donate")} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
                  Donate Now
                </Button>
                <Button href={routeHref("volunteer")} variant="vu-outline" size="lg" icon="none" className="min-w-[200px]">
                  Become a Volunteer
                </Button>
                <Button href={routeHref("support")} variant="vu-outline" size="lg" icon="none" className="min-w-[200px]">
                  Request Support
                </Button>
              </>
            )}
          </div>
        </Reveal>
      </section>
    );
  }

  const notice = variant === "safeguarding" ? (emergencyNotice ?? EMERGENCY_BODY) : emergencyNotice;
  return (
    <section aria-labelledby={id} className={cn("relative isolate overflow-hidden bg-deep pt-28 text-white focus-marigold md:pt-36", last ? lastPad : "pb-28 md:pb-36", className)}>
      <CoralBlob className="absolute -top-2 left-[3%] -z-10 w-[170px] md:w-[210px]" />
      <GreenBlobHeart className="absolute right-0 top-0 -z-10 w-[170px] md:w-[230px]" />
      {hands ? <Hands hands={hands} /> : null}

      <Reveal stagger={0.12} className="wrap relative flex flex-col items-center text-center">
        <h2 id={id} className="max-w-[760px] text-balance text-[34px] font-extrabold leading-[1.2] md:text-[46px] xl:text-[52px]">
          {heading}
        </h2>
        {body ? <p className="mt-5 max-w-[600px] text-[16px] leading-[1.8] text-white/85">{body}</p> : null}
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          {actions ??
            (variant === "safeguarding" ? (
              <>
                <Button href={routeHref("support")} variant="marigold-ink" size="lg">
                  Request Support
                </Button>
                <Button href={routeHref("report")} variant="outline-light" size="lg" icon="none">
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert aria-hidden className="size-4" strokeWidth={2.5} /> Report a Concern
                  </span>
                </Button>
              </>
            ) : (
              <>
                <Button href={routeHref("volunteer")} variant="marigold-ink" size="lg">
                  Become a Volunteer
                </Button>
                <Button href={routeHref("partner")} variant="outline-light" size="lg" icon="none">
                  Partner With Us
                </Button>
              </>
            ))}
        </div>
        {notice ? (
          <p className="mt-8 flex max-w-[640px] items-start gap-2.5 rounded-2xl bg-white/[0.06] px-5 py-3.5 text-left text-[13.5px] leading-relaxed text-white/80">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold" />
            {notice}
          </p>
        ) : null}
      </Reveal>
    </section>
  );
}
