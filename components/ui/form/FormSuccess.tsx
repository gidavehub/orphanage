"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Heart, ShieldCheck } from "lucide-react";
import { Timeline, type TimelineItem } from "../Timeline";
import { cn } from "@/lib/cn";

export type FormSuccessProps = {
  title: string;
  /** The record reference (HVN-SR-2026-0142, HVN-K7Q2-M9XD); shown in a copyable chip. */
  reference?: string;
  referenceLabel?: string;
  message: React.ReactNode;
  /** "What happens next" steps. */
  next?: TimelineItem[];
  nextTitle?: string;
  actions?: React.ReactNode;
  /** `forest` for support and contact, `coral` for donations. */
  tone?: "coral" | "forest";
  /** `shield` for concerns (ShieldCheck instead of the heart). */
  icon?: "heart" | "shield";
  className?: string;
};

/**
 * The sent state that replaces a form in place (design-system §3.3), generalised from the donate
 * card's done step: a pulsing disc, an Anton title, the reference chip and what happens next.
 * `role="status"`; focus moves to the title so the confirmation is read straight away.
 */
export function FormSuccess({
  title,
  reference,
  referenceLabel = "Your reference",
  message,
  next,
  nextTitle = "What happens next",
  actions,
  tone = "forest",
  icon = "heart",
  className,
}: FormSuccessProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const disc = tone === "coral" ? "bg-coral-800" : "bg-forest";
  return (
    <div role="status" className={cn("animate-[hero-rise_0.7s_var(--ease-out-expo)_both] text-center motion-reduce:animate-none", className)}>
      <span className={cn("relative mx-auto grid size-16 place-items-center rounded-full text-white", disc)}>
        <span aria-hidden className={cn("absolute inset-0 animate-pulse-ring rounded-full", disc)} />
        {icon === "shield" ? (
          <ShieldCheck aria-hidden className="relative size-7" strokeWidth={2.25} />
        ) : (
          <Heart aria-hidden className="relative size-7 animate-heartbeat" fill="currentColor" strokeWidth={0} />
        )}
      </span>
      <h2 ref={heading} tabIndex={-1} className="mt-5 font-display text-[34px] uppercase leading-none text-ink outline-offset-8 focus-forest">
        {title}
      </h2>
      {reference ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <p className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 font-grotesk text-[14px] text-umber">
            {referenceLabel}: <strong className="font-semibold tabular-nums tracking-[0.02em]">{reference}</strong>
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reference);
                setCopied(true);
              } catch {
                /* clipboard blocked: the reference is still on screen */
              }
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-forest transition-colors hover:bg-mint"
          >
            {copied ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <Copy aria-hidden className="size-4" strokeWidth={2.25} />}
            {copied ? "Copied" : "Copy"}
            <span className="sr-only"> your reference</span>
          </button>
        </div>
      ) : null}
      <div className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-body">{message}</div>
      {next && next.length ? (
        <div className="mx-auto mt-10 max-w-[520px] rounded-control bg-cream p-6 text-left md:p-7">
          <h3 className="text-[18px] font-extrabold text-ink">{nextTitle}</h3>
          <Timeline items={next} variant="process" className="mt-5" />
        </div>
      ) : null}
      {actions ? <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
