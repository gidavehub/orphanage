import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, FileText, Lock, ReceiptText, ShieldCheck } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { cn } from "@/lib/cn";
import type { UiImage } from "@/lib/model/ui";

// Server-rendered sections of the donate page's left column (public-pages §4.5.4–4.5.7): how a gift
// reaches a child, trust and transparency, and the donation FAQ. Copy comes from pages.donate, the
// home journey steps, settings.site registrations and the FAQ collection.

function Heading({ id, eyebrow, title, light }: { id: string; eyebrow?: string; title: string[]; light?: boolean }) {
  return (
    <>
      {eyebrow ? <p className={cn("font-script text-[22px] font-bold leading-none md:text-[24px]", light ? "text-marigold" : "text-marigold-ink")}>{eyebrow}</p> : null}
      <h2 id={id} className={cn("mt-2 text-[28px] font-extrabold leading-tight md:text-[34px]", light ? "text-white" : "text-ink")}>
        {title.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </h2>
    </>
  );
}

/** "How We Make Sure It Reaches a Child": the founder's verify-before-giving journey, compact. */
export function ReachChild({
  eyebrow,
  title,
  intro,
  steps,
}: {
  eyebrow?: string;
  title: string[];
  intro?: string;
  steps: Array<{ id: string; title: string; text: string; image?: UiImage }>;
}) {
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="reach-title" className="relative overflow-hidden rounded-card-lg bg-deep p-6 text-white sm:p-8 md:p-10">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-forest/50 blur-2xl" />
      <div className="relative">
        <Heading id="reach-title" eyebrow={eyebrow} title={title} light />
        {intro ? <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-white/80">{intro}</p> : null}
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.id} className="group relative flex gap-4 rounded-card bg-white/[0.06] p-4 ring-1 ring-white/10 transition-colors duration-500 hover:bg-white/[0.1]">
              {s.image ? (
                <span className="relative hidden size-16 shrink-0 overflow-hidden rounded-[16px] sm:block">
                  <Image src={s.image.src} alt="" fill sizes="64px" className="object-cover opacity-90 transition-transform duration-700 ease-out-expo group-hover:scale-110" />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="font-display text-[26px] leading-none text-marigold">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-1.5 block text-[17px] font-bold leading-snug text-white">{s.title}</span>
                <span className="mt-1 block text-[14.5px] leading-relaxed text-white/75">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const TRUST_ICON = { lock: Lock, card: CreditCard, receipt: ReceiptText, chart: BarChart3, shield: ShieldCheck } as const;

/** Trust and transparency: card safety, Stripe, receipts, registrations and where to read the reports. */
export function TrustPanel({
  eyebrow,
  title,
  items,
  registrations,
  impactHref,
  reportHref,
  reportLabel,
}: {
  eyebrow?: string;
  title: string[];
  items: Array<{ title: string; text?: string; icon?: string }>;
  registrations: Array<{ label: string; number: string }>;
  impactHref: string;
  reportHref: string;
  reportLabel: string;
}) {
  return (
    <section aria-labelledby="trust-title" className="rounded-card-lg bg-cream p-6 sm:p-8 md:p-10">
      <Heading id="trust-title" eyebrow={eyebrow} title={title} />
      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const Icon = TRUST_ICON[(it.icon ?? "shield") as keyof typeof TRUST_ICON] ?? ShieldCheck;
          return (
            <li key={it.title} className="flex gap-3.5 rounded-card bg-white p-4 shadow-[0_12px_30px_-26px_rgba(74,44,26,0.5)]">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-mint text-forest">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-[16px] font-bold leading-snug text-ink">{it.title}</span>
                {it.text ? <span className="mt-1 block text-[14.5px] leading-relaxed text-body">{it.text}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {registrations.length ? (
        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-grotesk text-[13.5px] text-body">
          {registrations.map((r) => (
            <div key={r.label} className="flex gap-1.5">
              <dt>{r.label}:</dt>
              <dd className="font-semibold text-ink">{r.number}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={impactHref} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-[14px] font-bold text-white transition-colors duration-300 hover:bg-deep">
          See our impact <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href={reportHref} className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/70 px-6 text-[14px] font-bold text-ink transition-colors duration-300 hover:border-forest hover:bg-forest hover:text-white">
          <FileText aria-hidden className="size-4" /> {reportLabel}
        </Link>
      </div>
    </section>
  );
}

/** The donation FAQ (FaqAccordion, placement "donate"). */
export function DonateFaq({ eyebrow, title, items }: { eyebrow?: string; title: string[]; items: Array<{ id: string; q: string; a: string }> }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="donate-faq-title" id="questions" className="scroll-mt-28">
      <Heading id="donate-faq-title" eyebrow={eyebrow} title={title} />
      <Accordion
        className="mt-7"
        headingLevel={3}
        items={items.map((f) => ({ id: f.id, title: f.q, content: <p className="text-[16px] leading-relaxed text-body">{f.a}</p> }))}
      />
    </section>
  );
}
