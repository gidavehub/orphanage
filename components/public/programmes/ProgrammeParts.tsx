import Image from "next/image";
import { Check, ClipboardList, Clock3, Mail, MessageCircle, Phone, UsersRound } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { BrushReveal } from "@/components/art/BrushReveal";
import { EmergencyBlock } from "@/components/public/help/EmergencyBlock";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Notice } from "@/components/ui/Notice";
import { Reveal } from "@/components/ui/Reveal";
import { DonatHeading } from "@/components/ui/SectionHeading";
import type { ProgrammeNoticeView } from "@/lib/content/types";
import type { UiImage } from "@/lib/model/ui";
import { EveryChildNote } from "@/components/public/EveryChildNote";
import { cn } from "@/lib/cn";

/* ── Notices band (public-pages §3.4.2; PLAN D41) ──────────────────────── */

/**
 * The programme's mandatory notices, directly under the hero and never collapsed. Tone mapping (D41):
 * `emergency` → the emergency block (settings.safety sentence and verified numbers) with the
 * programme's own line under it; `eligibility` → info; `medical | legal | assessment` → disclaimer.
 */
export function ProgrammeNotices({
  notices,
  emergency,
  everyChild,
}: {
  notices: ProgrammeNoticeView[];
  emergency: { text: string; contacts: ReadonlyArray<{ country: string; label: string; number: string }> };
  /** settings.site.everyChild, after the programme's own notices. */
  everyChild?: string;
}) {
  if (!notices.length && !everyChild) return null;
  return (
    <div className="bg-white pt-8 md:pt-10">
      <div className="wrap grid max-w-[980px] gap-3">
        {notices.map((n) =>
          n.tone === "emergency" ? (
            <EmergencyBlock key={n.kind} text={emergency.text} contacts={emergency.contacts} action={<p className="font-bold text-marigold">{n.text}</p>} />
          ) : n.tone === "info" ? (
            <Notice key={n.kind} tone="info" title="Please know">
              {n.text}
            </Notice>
          ) : (
            <Notice key={n.kind} tone="disclaimer">
              {n.text}
            </Notice>
          ),
        )}
        <EveryChildNote text={everyChild} compact />
      </div>
    </div>
  );
}

/* ── Overview (public-pages §3.4.4) ─────────────────────────────────────── */

/** The About-style split: a brush-masked photo beside the overview paragraphs and two next steps. */
export function ProgrammeOverview({
  title,
  image,
  children,
  actions,
}: {
  title: string[];
  image: UiImage & { objectPosition?: string };
  children: React.ReactNode;
  actions: { primary: { label: string; href: string }; secondary: { label: string; href: string } };
}) {
  return (
    <section id="overview" aria-labelledby="overview-title" className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="wrap grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div className="relative mx-auto aspect-[1/0.92] w-full max-w-[540px]">
          <BrushReveal name="strokes" color="var(--color-mist)" className="absolute -right-[10%] -top-[10%] w-[66%] rotate-[8deg]" duration={1.6} />
          <Reveal className="absolute bottom-[-4%] left-[14%] right-[4%] top-[12%]" y={30}>
            <div className="relative size-full rounded-[44px] border-[12px] border-marigold-100">
              <span aria-hidden className="absolute -top-[12px] right-[16%] h-[12px] w-[34%] bg-forest" />
            </div>
          </Reveal>
          <BrushReveal immediate name="patch" direction="up" className="absolute bottom-[-10%] left-[-4%] right-[8%] top-[-4%]" duration={1.8} delay={0.15}>
            <div className="relative size-full">
              <Image
                src={image.src}
                alt={image.decorative ? "" : image.alt}
                fill
                sizes="(min-width:1024px) 540px, 90vw"
                style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
                className="object-cover"
              />
              {image.illustrative ? <ImageCredit position="static" className="absolute bottom-[17%] left-[17%]" /> : null}
            </div>
          </BrushReveal>
          <Brush name="drip" color="var(--color-forest)" className="absolute -left-3 bottom-[6%] w-[14%] opacity-80" rotate={160} />
        </div>

        <Reveal stagger={0.1}>
          <Eyebrow lines="right" tone="ink">
            Overview
          </Eyebrow>
          <DonatHeading id="overview-title" lines={title} className="mt-4" />
          <div className="mt-6 max-w-[580px] text-[16px] leading-[1.8] text-body md:text-[17px] [&_p+p]:mt-5">{children}</div>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button href={actions.primary.href} variant="forest" size="lg" className="max-sm:w-full">
              {actions.primary.label}
            </Button>
            <ArrowLink href={actions.secondary.href} className="font-bold">
              {actions.secondary.label}
            </ArrowLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Support provided (public-pages §3.4.6) ─────────────────────────────── */

/** White rounded tiles with a forest check disc: the full ToR §5 service list. */
export function SupportTiles({ items, className }: { items: Array<{ title: string; text?: string }>; className?: string }) {
  return (
    <Reveal as="ul" stagger={0.05} y={24} className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((s) => (
        <li
          key={s.title}
          className="group flex items-start gap-4 rounded-[26px] bg-white p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-6"
        >
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white shadow-[0_0_0_5px_var(--color-mint)] transition-colors duration-500 group-hover:bg-marigold group-hover:text-night"
          >
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div className="min-w-0 pt-1.5">
            <h3 className="text-[17px] font-bold leading-snug text-ink">{s.title}</h3>
            {s.text ? <p className="mt-1.5 text-[15px] leading-relaxed text-body">{s.text}</p> : null}
          </div>
        </li>
      ))}
    </Reveal>
  );
}

/* ── Eligibility (public-pages §3.4.7; PLAN D41) ────────────────────────── */

function CriteriaCard({ title, items, icon, tone }: { title: string; items: string[]; icon: "who" | "ask"; tone: "forest" | "clay" }) {
  const Icon = icon === "who" ? UsersRound : ClipboardList;
  return (
    <div className="relative overflow-hidden rounded-card-lg bg-paper p-6 sm:p-8">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", tone === "forest" ? "bg-forest" : "bg-clay")} />
      <h3 className="flex items-center gap-3 text-[21px] font-extrabold leading-tight text-ink">
        <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full", tone === "forest" ? "bg-mint text-forest" : "bg-clay-100 text-clay-700")}>
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        {title}
      </h3>
      <ul className="mt-6 grid gap-4">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-3 text-[16px] leading-relaxed text-ink">
            <span aria-hidden className={cn("mt-[3px] grid size-[22px] shrink-0 place-items-center rounded-full text-white", tone === "forest" ? "bg-forest" : "bg-clay-700")}>
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Who can ask" and "What we'll ask for" side by side, then the review note and "Ask us". */
export function EligibilityLists({
  who,
  whatWeAsk,
  note,
  ask,
}: {
  who: string[];
  whatWeAsk: string[];
  note: string;
  ask: { href: string };
}) {
  return (
    <>
      <Reveal stagger={0.12} y={30} className="grid gap-5 lg:grid-cols-2">
        {who.length ? <CriteriaCard title="Who can ask" items={who} icon="who" tone="forest" /> : null}
        {whatWeAsk.length ? <CriteriaCard title="What we'll ask for" items={whatWeAsk} icon="ask" tone="clay" /> : null}
      </Reveal>
      <div className="mt-6 grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Notice tone="info" title="Please know">
          {note}
        </Notice>
        <div className="flex flex-col items-start gap-1 lg:items-end lg:text-right">
          <p className="text-[15px] font-bold text-ink">Not sure if you qualify?</p>
          <ArrowLink href={ask.href} className="font-bold">
            Ask us
          </ArrowLink>
        </div>
      </div>
    </>
  );
}

/* ── Programme contact (public-pages §3.4.14) ───────────────────────────── */

/** The programme team's role mailbox, phone and hours, and "Message the Programme Team". Never a personal name. */
export function ProgrammeContact({
  team,
  email,
  phone,
  hours,
  messageHref,
}: {
  team: string;
  email: string;
  phone?: { label: string; href: string };
  hours?: string;
  messageHref: string;
}) {
  return (
    <Reveal y={30} className="relative isolate overflow-hidden rounded-card-lg bg-deep px-6 py-10 text-white sm:px-10 md:px-14 md:py-14">
      <Brush name="strokes" color="var(--color-forest)" rotate={-12} className="absolute -right-16 -top-10 -z-10 w-[55%] opacity-70" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="font-script text-[24px] font-bold leading-none text-marigold">Talk to us</p>
          <h2 id="contact-title" className="mt-3 text-[30px] font-extrabold leading-tight md:text-[38px]">
            {team}
          </h2>
          <ul className="mt-7 grid gap-3 text-[16px]">
            <li>
              <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-3 break-all font-bold underline decoration-marigold decoration-2 underline-offset-4 hover:text-marigold">
                <Mail aria-hidden className="size-5 shrink-0 text-marigold" strokeWidth={2.25} />
                {email}
              </a>
            </li>
            {phone ? (
              <li>
                <a href={phone.href} className="inline-flex min-h-11 items-center gap-3 font-bold underline decoration-marigold decoration-2 underline-offset-4 hover:text-marigold">
                  <Phone aria-hidden className="size-5 shrink-0 text-marigold" strokeWidth={2.25} />
                  {phone.label}
                </a>
              </li>
            ) : null}
            {hours ? (
              <li className="flex items-start gap-3 text-white/90">
                <Clock3 aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" strokeWidth={2.25} />
                {hours}
              </li>
            ) : null}
          </ul>
        </div>
        <Button href={messageHref} variant="marigold-ink" size="lg" icon="none" className="max-sm:w-full">
          <span className="inline-flex items-center gap-2">
            <MessageCircle aria-hidden className="size-5" strokeWidth={2.25} /> Message the Programme Team
          </span>
        </Button>
      </div>
    </Reveal>
  );
}
