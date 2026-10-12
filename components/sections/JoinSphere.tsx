"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { subscribe } from "@/app/(site)/actions";
import { gsap, prefersReducedMotion } from "@/lib/motion/gsap";
import { AutoVideo } from "@/components/ui/AutoVideo";
import { Spinner } from "@/components/ui/Spinner";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { IDLE, type FormState } from "@/lib/forms/types";
import type { HomeView } from "@/lib/content/types";
import { cn } from "@/lib/cn";

// Vertical capsule slices that together read as a sphere (Voices United "Join").
const SLICES = 11;
const slices = Array.from({ length: SLICES }, (_, i) => {
  const cx = (i + 0.5) / SLICES; // 0..1
  const d = Math.abs(cx - 0.5) * 2; // 0 centre → 1 edge
  const ry = 0.5 * Math.sqrt(Math.max(0, 1 - d * d * 0.92)); // sphere profile
  return { cx, rx: 0.5 / SLICES - 0.012, ry: Math.max(0.09, ry) };
});

/**
 * Voices United "Join": a sphere of film slices over the newsletter sign-up. The form posts to the
 * site's `subscribe` action (double opt-in, D103) with the anti-spam controls every public form
 * carries; the answer (confirmation sent, or why not) is announced under the form.
 */
export function JoinSphere({ join }: { join: HomeView["join"] }) {
  const root = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(subscribe, IDLE);
  const done = state.status === "success";
  const fieldError = state.status === "error" ? state.fieldErrors?.email : undefined;
  const error = state.status === "error" ? (fieldError ?? state.message) : null;
  const statusId = useId();

  // Reveal + idle "voice" wave, driven by IntersectionObserver (this section sits in a
  // content-visibility region, so no ScrollTrigger positions are relied on here).
  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ellipses = Array.from(el.querySelectorAll<SVGEllipseElement>("[data-slice]"));
    const order = [...ellipses].sort((a, b) => Math.abs(Number(a.dataset.cx) - 0.5) - Math.abs(Number(b.dataset.cx) - 0.5));
    gsap.set(ellipses, { attr: { ry: 0 } });
    let waves: gsap.core.Tween[] = [];
    let revealed = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !revealed && e.intersectionRatio > 0.3) {
          revealed = true;
          gsap.to(order, {
            attr: { ry: (i: number, t: SVGEllipseElement) => Number(t.dataset.ry) },
            duration: 1.2,
            ease: "power4.out",
            stagger: 0.07,
            onComplete: () => {
              waves = ellipses.map((t, i) =>
                gsap.to(t, { attr: { ry: Number(t.dataset.ry) * 0.93 }, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.12 }),
              );
            },
          });
        }
        waves.forEach((w) => (e.isIntersecting ? w.play() : w.pause()));
      },
      { threshold: [0, 0.3] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      gsap.killTweensOf(ellipses);
    };
  }, []);

  return (
    <section ref={root} aria-labelledby="join-title" className="relative overflow-hidden bg-coral pb-24 pt-20 text-white md:pb-28 cv-auto">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id="join-sphere" clipPathUnits="objectBoundingBox">
            {slices.map((s, i) => (
              <ellipse key={i} data-slice data-cx={s.cx} data-ry={s.ry} cx={s.cx} cy={0.5} rx={s.rx} ry={s.ry} />
            ))}
          </clipPath>
        </defs>
      </svg>

      <div className="wrap flex flex-col items-center">
        <div className="relative aspect-[560/620] w-[min(78vw,520px)] overflow-hidden" style={{ clipPath: "url(#join-sphere)" }}>
          <AutoVideo src={join.media.src} poster={join.media.poster} aria-hidden className="absolute inset-[-8%] size-[116%] max-w-none object-cover" />
        </div>

        <h2 id="join-title" className="mt-10 text-center font-display text-[42px] uppercase leading-none md:text-[64px]">
          {join.title[0]} <span className="text-night">{join.title[1]}</span> {join.title[2]}
        </h2>
        <p className="mt-4 max-w-[440px] text-center font-grotesk text-[15px] text-white">{join.text}</p>

        <form action={formAction} className="relative mt-8 flex w-full max-w-[640px] flex-col gap-3 sm:flex-row">
          <Honeypot />
          <Turnstile action="newsletter" />
          <input type="hidden" name="source" value="join_section" />
          <label className="flex-1">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              value={email}
              readOnly={done}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={statusId}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              autoComplete="email"
              className="h-[60px] w-full rounded-full bg-white/15 px-7 font-grotesk text-[17px] text-white placeholder:text-white/85 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </label>
          <button
            type="submit"
            disabled={done || pending}
            aria-busy={pending || undefined}
            className={cn(
              "flex h-[60px] min-w-[170px] items-center justify-center gap-2 rounded-full bg-white px-8 font-grotesk text-[14px] font-medium uppercase tracking-[0.03em] text-ink transition-colors",
              done ? "bg-night text-white" : "hover:bg-night hover:text-white",
            )}
          >
            {done ? (
              <>
                <Check aria-hidden className="size-4" /> Subscribed
              </>
            ) : pending ? (
              <>
                <Spinner size={16} label="" /> Subscribing
              </>
            ) : (
              "Subscribe"
            )}
          </button>
        </form>
        <div id={statusId} aria-live="polite" className="w-full max-w-[640px] text-center">
          {done ? (
            <p className="mt-4 rounded-[22px] bg-night/20 px-5 py-3 font-grotesk text-[15px] leading-snug text-white">
              {state.message ?? "Thank you! Please check your inbox and confirm your email to start receiving updates."}
            </p>
          ) : error ? (
            <p className="mt-4 rounded-[22px] bg-night/25 px-5 py-3 font-grotesk text-[15px] leading-snug text-white">{error}</p>
          ) : null}
        </div>
        <p className="mt-3 font-grotesk text-[12px] text-white/90">{join.note}</p>
      </div>
    </section>
  );
}
