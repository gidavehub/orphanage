"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, Heart, Mail } from "lucide-react";
import { subscribe } from "@/app/(site)/actions";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { useToast } from "@/components/ui/Toast";
import { IDLE, type FormState } from "@/lib/forms/types";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";
import { trackDonate } from "../track";

// Small client leaves of /donate/thank-you (public-pages §4.9): the heart burst, Copy buttons for the
// reference and payment details, the compact newsletter sign-up and the donate_complete event.

/** The landing's pulse-ring heart plus marigold hearts drifting up for 1.2s (static under reduced motion). */
export function HeartBurst({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || reduce) return;
    const hearts = Array.from(root.querySelectorAll<HTMLElement>("[data-drift]"));
    const anims = hearts.map((h, i) => {
      const dx = (i % 2 === 0 ? -1 : 1) * (18 + i * 9);
      return h.animate(
        [
          { transform: "translate(-50%, 0) scale(0.4)", opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.4}px), -30px) scale(1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${dx}px), -${92 + i * 14}px) scale(0.8)`, opacity: 0 },
        ],
        { duration: 1200, delay: 150 + i * 90, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [reduce]);

  return (
    <span ref={ref} aria-hidden className={cn("relative grid size-[76px] place-items-center rounded-full bg-coral text-white", className)}>
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-coral motion-reduce:hidden" />
      <Heart className="relative size-8 animate-heartbeat motion-reduce:animate-none" fill="currentColor" strokeWidth={0} />
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} data-drift className="absolute left-1/2 top-0 opacity-0" style={{ transform: "translate(-50%, 0)" }}>
          <Heart className={cn("text-marigold", i % 2 ? "size-4" : "size-5")} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </span>
  );
}

/** A Copy button for one value (reference, account number). Confirms with a toast and a tick. */
export function CopyValue({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  const { toast, available } = useToast();
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 2000);
    return () => window.clearTimeout(t);
  }, [done]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    if (available) toast({ title: `${label} copied`, tone: "success" });
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 font-grotesk text-[12.5px] font-semibold transition-colors duration-300",
        done ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest hover:text-forest",
        className,
      )}
    >
      {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : <Copy aria-hidden className="size-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** donate_complete {route} once per page view (no personal data). */
export function TrackComplete({ route }: { route: string }) {
  useEffect(() => {
    trackDonate({ name: "donate_complete", data: { route } });
  }, [route]);
  return null;
}

/** A compact newsletter sign-up for donors who did not ask for updates (the site's subscribe action). */
export function ThanksSubscribe({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribe, IDLE);
  const err = state.status === "error" ? (state.fieldErrors?.email ?? state.message) : null;
  return (
    <div className="rounded-card-lg bg-deep p-6 text-white sm:p-8">
      {eyebrow ? <p className="font-script text-[22px] font-bold leading-none text-marigold">{eyebrow}</p> : null}
      <h2 className="mt-2 text-[24px] font-extrabold leading-tight md:text-[28px]">{title}</h2>
      {text ? <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed text-white/80">{text}</p> : null}
      {state.status === "success" ? (
        <p role="status" className="mt-5 flex items-start gap-2.5 rounded-2xl bg-white/10 px-4 py-3 text-[15px] font-semibold">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold" />
          {state.message ?? "Thank you. Please check your inbox to confirm your email address."}
        </p>
      ) : (
        <form action={action} className="relative mt-5 flex flex-col gap-3" noValidate>
          <Honeypot />
          <input type="hidden" name="source" value="donation" />
          <label htmlFor="thanks-email" className="sr-only">
            Email address
          </label>
          <input
            id="thanks-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Your email address"
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? "thanks-email-error" : undefined}
            defaultValue={state.status === "error" ? (state.values?.email ?? "") : ""}
            className="h-[52px] w-full min-w-0 rounded-full bg-white/15 px-6 font-grotesk text-[16px] text-white placeholder:text-white/75 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-marigold px-7 text-[15px] font-bold text-night transition-colors duration-300 hover:bg-white disabled:opacity-70"
          >
            {pending ? "Sending…" : "Keep me posted"}
          </button>
        </form>
      )}
      {err ? (
        <p id="thanks-email-error" role="alert" className="mt-3 text-[14px] font-semibold text-white">
          {err}
        </p>
      ) : null}
    </div>
  );
}
