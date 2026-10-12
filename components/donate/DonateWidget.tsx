"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { scrollToId } from "@/components/ui/AnchorLink";
import { DONATE_EVENT, type DonateIntent } from "@/lib/donate-intent";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { frequencyToUrl, parseDonateQuery } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { DonateCard, DEFAULT_COPY, type DonateCopy } from "./DonateCard";
import { useDonateContext } from "./DonateStateProvider";
import { amountOf, donateReducer, guessCurrency, initialState, presetsFor, type DonateState, type GivingConfig, type WidgetCause } from "./model";
import { trackDonate } from "./track";

// The persistent donate widget (public-pages §4.3–4.4, §4.10).
// - variant "page" (/donate, /donate/[cause]): state from DonateStateProvider; the URL is state
//   (?amount=&currency=&frequency=&mode=&ref=, mirrored with history.replaceState so nothing is
//   refetched); the cause comes from the route segment; reads useSearchParams, so it renders inside
//   <Suspense> with WidgetSkeleton as the fallback.
// - variant "landing" (home #donate): local state, the cause as a <select>, no URL syncing, and an
//   appeal card's "Donate Now" (requestDonation) preselects that appeal and its currency.

export type DonateWidgetProps =
  | { variant: "page"; className?: string }
  | { variant: "landing"; config: GivingConfig; causes: WidgetCause[]; copy?: DonateCopy; className?: string };

export function DonateWidget(props: DonateWidgetProps) {
  return props.variant === "page" ? <PageWidget className={props.className} /> : <LandingWidget {...props} />;
}

const SPONSOR_CAUSE = "sponsor-a-child";

function clip(v: string | null, max: number): string | undefined {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : undefined;
}

function effectiveCause(bySlug: Map<string, WidgetCause>, slug: string): WidgetCause | null {
  const given = bySlug.get(slug) ?? null;
  if (given && (given.live || given.kind === "general")) return given;
  return bySlug.get("general") ?? given;
}

function PageWidget({ className }: { className?: string }) {
  const ctx = useDonateContext();
  if (!ctx) throw new Error("DonateWidget variant=\"page\" must be inside DonateStateProvider.");
  const { state, dispatch, config, causes, bySlug, setActiveSlug, widgetRef } = ctx;
  const params = useParams<{ cause?: string }>();
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const lenis = useLenis();
  const slug = typeof params.cause === "string" ? decodeURIComponent(params.cause) : "general";
  const cause = effectiveCause(bySlug, slug);
  const causeSlug = cause?.slug ?? "general";
  const [glow, setGlow] = useState(false);

  useEffect(() => setActiveSlug(causeSlug), [causeSlug, setActiveSlug]);

  // Read the shareable URL once: amount, currency, frequency, mode, sponsorship ref, cancel flag, UTM.
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const q = parseDonateQuery(sp);
    const enabled = config.currencies.map((c) => c.code);
    const currency = q.currency && enabled.includes(q.currency) ? q.currency : guessCurrency(enabled);
    const allowed = cause?.allowedFrequencies ?? ["one_time"];
    const frequency = q.frequency && allowed.includes(q.frequency) ? q.frequency : cause && allowed.includes(cause.defaultFrequency) ? cause.defaultFrequency : allowed[0];
    const min = config.currencies.find((c) => c.code === currency)?.min ?? 0;
    const patch: Partial<DonateState> = { currency, estCurrency: currency, frequency };
    if (q.amount && q.amount >= min && q.amount <= 100_000_000) {
      if (presetsFor(cause, config, currency).includes(q.amount)) patch.amount = q.amount;
      else patch.other = String(q.amount);
    }
    if (q.mode === "in-kind") patch.mode = "in_kind";
    if (q.ref && (slug === SPONSOR_CAUSE || cause?.kind === "sponsorship")) patch.ref = q.ref;
    if (sp.get("cancelled") === "1") patch.cancelled = true;
    const utm = { utmSource: clip(sp.get("utm_source"), 200), utmMedium: clip(sp.get("utm_medium"), 200), utmCampaign: clip(sp.get("utm_campaign"), 200) };
    let referrer: string | undefined;
    try {
      if (document.referrer && new URL(document.referrer).origin !== window.location.origin) referrer = document.referrer.slice(0, 500);
    } catch {
      referrer = undefined;
    }
    if (utm.utmSource || utm.utmMedium || utm.utmCampaign || referrer) {
      patch.attribution = { ...(utm.utmSource ? { utmSource: utm.utmSource } : {}), ...(utm.utmMedium ? { utmMedium: utm.utmMedium } : {}), ...(utm.utmCampaign ? { utmCampaign: utm.utmCampaign } : {}), ...(referrer ? { referrer } : {}) };
    }
    dispatch({ type: "hydrate", patch });
    // Runs once on mount: later URL changes come from this widget itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The URL is state: once the donor changes something, mirror it without a navigation.
  const value = amountOf(state);
  useEffect(() => {
    if (!state.dirty) return;
    const q = new URLSearchParams();
    if (state.mode === "cash" && value > 0) q.set("amount", String(value));
    q.set("currency", state.currency);
    if (state.mode === "cash") q.set("frequency", frequencyToUrl(state.frequency));
    if (state.mode === "in_kind") q.set("mode", "in-kind");
    if (state.ref) q.set("ref", state.ref);
    const next = `${pathname}?${q.toString()}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
  }, [state.dirty, state.mode, state.currency, state.frequency, state.ref, value, pathname]);

  useEffect(() => {
    trackDonate({ name: "donate_view", data: { cause: causeSlug } });
  }, [causeSlug]);

  // An impact example or "Give in kind" elsewhere on the page asks for the widget's attention.
  const lastTick = useRef(state.focusTick);
  useEffect(() => {
    if (state.focusTick === lastTick.current) return;
    lastTick.current = state.focusTick;
    if (window.matchMedia("(max-width: 1023.98px)").matches) scrollToId("donate-widget", lenis);
    setGlow(true);
    const t = window.setTimeout(() => setGlow(false), 1400);
    return () => window.clearTimeout(t);
  }, [state.focusTick, lenis]);

  const onCauseChange = (next: string) => {
    trackDonate({ name: "donate_cause_change", data: { cause: next } });
    const q = new URLSearchParams();
    if (state.dirty || value > 0) {
      if (state.mode === "cash" && value > 0) q.set("amount", String(value));
      q.set("currency", state.currency);
      if (state.mode === "cash") q.set("frequency", frequencyToUrl(state.frequency));
    }
    if (state.mode === "in_kind") q.set("mode", "in-kind");
    if (state.ref && next === SPONSOR_CAUSE) q.set("ref", state.ref);
    const base = next === "general" ? "/donate" : `/donate/${encodeURIComponent(next)}`;
    const qs = q.toString();
    router.push(`${base}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div
      ref={widgetRef}
      id="donate-widget"
      tabIndex={-1}
      className={cn("scroll-mt-24 rounded-[30px] transition-shadow duration-700 focus:outline-none", glow && "shadow-[0_0_0_4px_rgba(242,94,68,0.35)]", className)}
    >
      <DonateCard variant="page" state={state} dispatch={dispatch} config={config} causes={causes} cause={cause} causeSlug={causeSlug} onCauseChange={onCauseChange} />
    </div>
  );
}

function LandingWidget({ config, causes, copy = DEFAULT_COPY, className }: { config: GivingConfig; causes: WidgetCause[]; copy?: DonateCopy; className?: string }) {
  const [state, dispatch] = useReducer(donateReducer, config.defaultCurrency, (c) => initialState(c));
  const [causeSlug, setCauseSlug] = useState("general");
  const [preselected, setPreselected] = useState(false);
  const bySlug = new Map(causes.map((c) => [c.slug, c]));
  const cause = effectiveCause(bySlug, causeSlug);

  // An appeal card's "Donate Now" lands here with that appeal and its currency preselected.
  useEffect(() => {
    const onIntent = (e: Event) => {
      const { causeSlug: slug, currency } = (e as CustomEvent<DonateIntent>).detail;
      setCauseSlug(slug);
      setPreselected(slug !== "general");
      dispatch({ type: "hydrate", patch: { mode: "cash", currency, estCurrency: currency, amount: null, other: "", step: "choose", submissionId: null } });
    };
    window.addEventListener(DONATE_EVENT, onIntent);
    return () => window.removeEventListener(DONATE_EVENT, onIntent);
  }, []);

  return (
    <DonateCard
      variant="landing"
      state={state}
      dispatch={dispatch}
      config={config}
      causes={causes}
      cause={cause}
      causeSlug={cause?.slug ?? "general"}
      onCauseChange={(slug) => {
        setCauseSlug(slug);
        setPreselected(false);
      }}
      copy={copy}
      preselected={preselected}
      className={className}
    />
  );
}

/** The widget's Suspense fallback: the card's silhouette while the URL is read. */
export function WidgetSkeleton() {
  return (
    <div aria-hidden className="rounded-[30px] bg-white p-5 shadow-[0_40px_80px_-40px_rgba(6,21,18,0.55)] sm:p-7">
      <div className="flex items-center gap-3">
        <span className="skeleton size-11 rounded-full" />
        <span className="grid flex-1 gap-2">
          <span className="skeleton h-3 w-16 rounded-full" />
          <span className="skeleton h-4 w-40 rounded-full" />
        </span>
      </div>
      <div className="mt-4 grid gap-2.5">
        <span className="skeleton h-12 rounded-full" />
        <span className="skeleton h-12 rounded-full" />
        <span className="skeleton h-12 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="skeleton h-11 rounded-full" />
        ))}
      </div>
      <span className="skeleton mt-2 block h-11 rounded-full" />
      <span className="skeleton mt-5 block h-14 rounded-full" />
    </div>
  );
}
