import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { Logo } from "@/components/art/Logo";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { img } from "@/lib/media/pipeline";
import { cn } from "@/lib/cn";

/** The team-at-work photo (a caregiver with a family; no identifiable child, design-system §5.2). */
const PHOTO = "journey-outreach";

/**
 * The warm front door for every staff auth page (admin-ux §6.1; design-system §5.2): a photo half
 * with the night gradient, a white brush edge and a Caveat thank-you on large screens; a 200px photo
 * band with a torn edge on phones; and a white card holding the form. Owns the page's
 * `<main id="main">` (the admin SkipLink target) because these pages sit outside the AdminShell.
 */
export function AuthFrame({
  children,
  quote = "Thank you for showing up for every child.",
  footer = true,
  plain = false,
}: {
  children: React.ReactNode;
  quote?: string;
  /** The "private area" note and "Back to the website" link under the card. */
  footer?: boolean;
  /** No photo: a centred card on the paper canvas (step-up confirm and the idle lock, which interrupt work). */
  plain?: boolean;
}) {
  if (plain) {
    return (
      <main id="main" tabIndex={-1} className="flex min-h-dvh items-start justify-center px-4 py-10 focus:outline-none sm:items-center sm:py-16">
        <div className="w-full max-w-[460px] rounded-card-lg bg-white p-6 shadow-modal sm:p-9">
          <Logo className="text-[30px]" />
          <div className="mt-6">{children}</div>
        </div>
      </main>
    );
  }
  return (
    <main id="main" tabIndex={-1} className="min-h-dvh focus:outline-none lg:grid lg:grid-cols-2">
      <div className="relative h-[200px] overflow-hidden bg-night lg:sticky lg:top-0 lg:h-dvh">
        <div className="absolute inset-0">
          <Image src={img(PHOTO)} alt="" fill preload sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-[50%_35%]" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(6_21_18/0.35)_0%,rgb(6_21_18/0.15)_40%,rgb(6_21_18/0.75)_100%)]" />
        <ImageCredit position="top-right" className="lg:right-auto lg:left-5 lg:top-5" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 lg:block xl:p-16">
          <p className="max-w-[420px] font-script text-[34px] font-bold leading-[1.15] text-white xl:text-[40px]">{quote}</p>
        </div>
        {/* Torn edge into the card area: bottom on phones, the right-hand side on large screens. */}
        <Brush name="torn" color="var(--color-paper)" className="absolute inset-x-0 -bottom-px w-full lg:hidden" style={{ aspectRatio: "1400 / 90" }} />
        <Brush name="edge" color="var(--color-paper)" className="absolute inset-y-0 -right-px hidden h-full lg:block" style={{ aspectRatio: "120 / 820" }} />
      </div>

      <div className="relative flex flex-col items-center px-4 pb-14 lg:justify-center lg:px-10 lg:py-16">
        <div className="relative -mt-10 w-full max-w-[460px] rounded-card-lg bg-white p-6 shadow-modal sm:p-9 lg:mt-0">
          <Link href="/" aria-label="Haven website home" className="inline-block">
            <Logo className="text-[34px]" />
          </Link>
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-6 grid w-full max-w-[460px] gap-4 px-2">
            <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-body">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={2.5} />
              A private area. Sign-ins and changes are recorded to keep children safe.
            </p>
            <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-[15px] font-bold text-forest underline-offset-4 hover:underline">
              <ArrowLeft aria-hidden className="size-4" strokeWidth={2.5} /> Back to the website
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** The card's heading block: Caveat eyebrow with rules, Nunito 800 title and a one-line lead. */
export function AuthHeading({ eyebrow, title, lead, className }: { eyebrow?: string; title: string; lead?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      {eyebrow ? (
        <p className="flex items-center gap-3 font-script text-[26px] font-bold leading-none text-forest">
          <span aria-hidden className="h-px w-8 bg-marigold" />
          {eyebrow}
          <span aria-hidden className="h-px w-8 bg-marigold" />
        </p>
      ) : null}
      <h1 className="text-balance text-[30px] font-extrabold leading-tight text-ink sm:text-[36px]">{title}</h1>
      {lead ? <div className="text-[16px] leading-relaxed text-body">{lead}</div> : null}
    </div>
  );
}
