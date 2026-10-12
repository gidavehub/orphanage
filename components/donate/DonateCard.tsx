"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Heart, Lock, Plus, Sparkles, X } from "lucide-react";
import { AnchorLink } from "@/components/ui/AnchorLink";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Segmented } from "@/components/ui/form/Segmented";
import { Textarea } from "@/components/ui/form/Textarea";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { Chips } from "@/components/ui/form/Chips";
import { HONEYPOT_FIELD, TURNSTILE_FIELD } from "@/lib/forms/spam";
import { Turnstile } from "@/components/ui/form/Turnstile";
import type { Currency, Frequency } from "@/lib/model/enums";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { plainNumber } from "@/lib/money";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { CausePicker } from "./CausePicker";
import {
  amountBucket,
  amountOf,
  buildPayload,
  currencyInfo,
  feeOf,
  impactHint,
  moneyExact,
  presetsFor,
  rememberCurrency,
  summaryLine,
  type DonateAction,
  type DonateState,
  type GivingConfig,
  type PaymentRoute,
  type WidgetCause,
} from "./model";
import { trackDonate } from "./track";

// The donate card (public-pages §4.4; design-system §3.3): the landing card's visual language
// unchanged (white 30px card, Segmented pills in Inter caps, coral rings and the coral CTA), shared by
// the landing (variant "landing": local state, cause <select>, no URL) and /donate (variant "page":
// shared state, "Giving to" row with the cause picker, impact hint and a compact "where it goes").

export type DonateCopy = {
  anywhereLabel: string;
  securityNote: string;
  updatesConsentLabel: string;
  anonymousLabel: string;
};

export const DEFAULT_COPY: DonateCopy = {
  anywhereLabel: "Where it’s needed most",
  securityNote: "We never store card details on this site.",
  updatesConsentLabel: "Yes, send me approved impact updates about how my gift helps.",
  anonymousLabel: "Keep my gift anonymous in any public recognition.",
};

type DonationResponse =
  | { kind: "stripe"; url: string }
  | { kind: "pledge"; next: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

const STEP1_FIELDS = new Set(["amount", "currency", "frequency", "cause", "items", "description", "condition", "handover", "location", "estValue", "estValue.amount", "ref", "method"]);

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good used" },
  { value: "mixed", label: "Mixed" },
] as const;

const HANDOVERS = [
  { value: "drop_off", label: "Drop off at an office" },
  { value: "collection", label: "Request collection" },
  { value: "shipping", label: "Ship to us" },
] as const;

const percentFmt = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Inline error under a compact control. */
function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 font-grotesk text-[13px] font-semibold leading-snug text-coral-800">
      <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
      <span>{children}</span>
    </p>
  );
}

export type DonateCardProps = {
  variant: "page" | "landing";
  state: DonateState;
  dispatch: React.Dispatch<DonateAction>;
  config: GivingConfig;
  causes: WidgetCause[];
  /** The cause the gift goes to (closed causes already fall back to general). */
  cause: WidgetCause | null;
  causeSlug: string;
  /** Page: navigate to another cause (the layout persists). Landing: set local state. */
  onCauseChange: (slug: string) => void;
  copy?: DonateCopy;
  /** Landing: the appeal chosen from an appeal card ("Giving to: …" chip + "See exactly where it goes"). */
  preselected?: boolean;
  className?: string;
};

export function DonateCard({ variant, state, dispatch, config, causes, cause, causeSlug, onCauseChange, copy = DEFAULT_COPY, preselected, className }: DonateCardProps) {
  const router = useRouter();
  const page = variant === "page";
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<{ text: string; offerPledge?: boolean; unavailable?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const lastBucket = useRef("");

  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const cur = currencyInfo(config, state.currency);
  const value = amountOf(state);
  const presets = presetsFor(cause, config, state.currency);
  const allowed: Frequency[] = useMemo(
    () => (cause?.allowedFrequencies?.length ? cause.allowedFrequencies : config.frequencies.map((f) => f.value)),
    [cause, config.frequencies],
  );
  const frequencies = config.frequencies.filter((f) => allowed.includes(f.value));
  const max = config.maxOnline[state.currency];
  const overMax = state.mode === "cash" && typeof max === "number" && value > max;
  const route: PaymentRoute = state.mode === "cash" && config.routes[state.currency] === "stripe" && !overMax ? "stripe" : "local";
  const anyCard = Object.values(config.routes).includes("stripe");
  const belowMin = state.mode === "cash" && value > 0 && value < cur.min;
  const canContinueCash = value >= cur.min;
  const fee = feeOf(value, config.coverFeesPercent);
  const frequencyLabel = FREQUENCY_LABEL[state.frequency];
  const causeTitle = cause && cause.kind !== "general" ? cause.title : copy.anywhereLabel;
  const methods = config.methods[state.currency] ?? [];
  const hint = page && state.mode === "cash" ? impactHint(cause, state.currency, value, config.fx) : null;

  // Keep the frequency valid for the cause (sponsorship is monthly only, for example).
  useEffect(() => {
    if (!allowed.includes(state.frequency)) dispatch({ type: "frequency", frequency: cause?.defaultFrequency && allowed.includes(cause.defaultFrequency) ? cause.defaultFrequency : allowed[0] });
  }, [allowed, state.frequency, cause, dispatch]);

  // A cause's in-kind items are pre-checked until the donor changes the selection.
  useEffect(() => {
    if (state.mode !== "in_kind" || state.itemsTouched || !cause) return;
    const want = cause.inKindItems.filter((i) => config.inKind.some((k) => k.value === i));
    if (want.join() !== state.items.join()) dispatch({ type: "items", items: want });
  }, [state.mode, state.itemsTouched, state.items, cause, config.inKind, dispatch]);

  // Analytics: amount bucket (debounced by bucket, never the amount itself).
  useEffect(() => {
    if (!(value >= cur.min)) return;
    const bucket = amountBucket(value, state.currency, config.fx);
    const key = `${state.currency}:${bucket}`;
    if (key === lastBucket.current) return;
    lastBucket.current = key;
    trackDonate({ name: "donate_amount_set", data: { currency: state.currency, bucket } });
  }, [value, cur.min, state.currency, config.fx]);

  // Move focus to the step heading when the step changes (not on first render). Compared with the
  // previous step rather than a first-run flag, so effects that run twice (dev) never steal focus
  // and scroll the page to the donate box.
  const shownStep = useRef(state.step);
  useEffect(() => {
    if (shownStep.current === state.step) return;
    shownStep.current = state.step;
    headingRef.current?.focus({ preventScroll: false });
  }, [state.step]);

  const setCurrency = (c: Currency) => {
    dispatch({ type: "currency", currency: c });
    rememberCurrency(c);
    setErrors({});
  };

  /* ── Step 1 → 2 ── */
  const validateChoose = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (state.mode === "cash") {
      if (!(value > 0)) e.amount = "Please choose or enter an amount.";
      else if (value < cur.min) e.amount = `The smallest gift in ${cur.code} is ${moneyExact(cur.min, cur.code)}.`;
    } else {
      if (state.items.length === 0) e.items = "Please choose at least one kind of item.";
      if (state.description.trim().length < 20) e.description = "Please describe what you'd like to give (at least 20 characters).";
      if (!state.condition) e.condition = "Please choose the condition.";
      if (!state.handover) e.handover = "Please choose how the items will reach us.";
      if (!state.location.trim()) e.location = "Please tell us the town or city.";
    }
    return e;
  };

  const goDetails = () => {
    const e = validateChoose();
    setErrors(e);
    setFormMessage(null);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.getElementById(id(first))?.focus();
      return;
    }
    if (!state.submissionId) dispatch({ type: "hydrate", patch: { submissionId: crypto.randomUUID() } });
    dispatch({ type: "step", step: "details" });
  };

  /* ── Submit ── */
  const validateDetails = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const d = state.donor;
    if (!d.fullName.trim()) e["donor.fullName"] = "Please enter your full name.";
    if (!EMAIL_RE.test(d.email.trim())) e["donor.email"] = "Please enter an email address like name@example.com.";
    if (!d.country) e["donor.country"] = "Please choose your country.";
    if (d.type === "organisation" && !d.organisation.trim()) e["donor.organisation"] = "Please add the organisation's name.";
    if (d.phone.trim() && !/^\+?[0-9 ()-]{6,24}$/.test(d.phone.trim())) e["donor.phone"] = "Please enter a phone number using digits, spaces and an optional + at the start.";
    return e;
  };

  const submit = async (opts: { pledgeInstead?: boolean } = {}) => {
    if (pending) return;
    const e = validateDetails();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormMessage({ text: "Please check the highlighted fields and try again." });
      document.getElementById(id(Object.keys(e)[0]))?.focus();
      return;
    }
    const submissionId = state.submissionId ?? crypto.randomUUID();
    if (!state.submissionId) dispatch({ type: "hydrate", patch: { submissionId } });
    setPending(true);
    setFormMessage(null);
    trackDonate({ name: "donate_checkout_start", data: { route: state.mode === "in_kind" ? "in_kind" : opts.pledgeInstead ? "local" : route } });
    const payload = buildPayload(state, causeSlug, {
      elapsed: performance.now() - startedAt.current,
      honeypot: honeypotRef.current?.value ?? "",
      submissionId,
      pledgeInstead: opts.pledgeInstead,
    });
    // Turnstile, when switched on, leaves its token in the form (integrations §9).
    const challenge = document.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`)?.value;
    if (challenge) (payload as Record<string, unknown>)[TURNSTILE_FIELD] = challenge;
    let res: DonationResponse;
    try {
      const r = await fetch("/api/donations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      res = (await r.json()) as DonationResponse;
    } catch {
      setPending(false);
      setFormMessage({
        text: state.mode === "cash" && route === "stripe" ? "We couldn't start the payment. Nothing has been charged. Please check your connection and try again." : "We couldn't send your gift. Please check your connection and try again.",
        offerPledge: state.mode === "cash" && route === "stripe",
      });
      return;
    }
    if (res.kind === "stripe") {
      dispatch({ type: "step", step: "redirecting" });
      window.location.assign(res.url);
      return;
    }
    if (res.kind === "pledge") {
      router.push(res.next);
      return;
    }
    setPending(false);
    if (res.kind === "unavailable") {
      setFormMessage({ text: res.message, unavailable: true });
      return;
    }
    const fe = res.fieldErrors ?? {};
    setErrors(fe);
    const keys = Object.keys(fe);
    if (keys.some((k) => STEP1_FIELDS.has(k))) dispatch({ type: "step", step: "choose" });
    setFormMessage({ text: res.message, offerPledge: state.mode === "cash" && route === "stripe" && keys.length === 0 });
  };

  const errId = (k: string) => (errors[k] ? `${id(k)}-err` : undefined);

  /* ── Pieces ── */
  const amountGrid = (
    <div
      className={cn("grid grid-cols-3", page ? "mt-4 gap-2" : "mt-5 gap-2")}
      role="radiogroup"
      aria-label="Amount"
      id={id("amount")}
      tabIndex={-1}
      aria-describedby={errId("amount")}
      onKeyDown={(e) => {
        const i = presets.findIndex((a) => a === state.amount);
        let next = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % presets.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + presets.length) % presets.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = presets.length - 1;
        if (next < 0) return;
        e.preventDefault();
        dispatch({ type: "preset", amount: presets[next] });
        (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
      }}
    >
      {presets.map((a, i) => {
        const on = state.amount === a;
        const tabbable = on || (state.amount === null || !presets.includes(state.amount) ? i === 0 : false);
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => {
              dispatch({ type: "preset", amount: a });
              setErrors((x) => ({ ...x, amount: "" }));
            }}
            className={cn(
              "rounded-full border font-grotesk font-medium transition-all duration-300",
              page ? "h-11 text-[15px]" : "h-12 text-[14px]",
              on ? "border-coral bg-coral/10 text-coral-800" : "border-mist text-ink hover:border-coral/50",
            )}
          >
            {plainNumber.format(a)}
          </button>
        );
      })}
    </div>
  );

  const otherField = (
    <label
      className={cn(
        "flex items-center rounded-full bg-field px-5 font-grotesk focus-within:ring-2 focus-within:ring-coral/40",
        page ? "mt-2 h-11 text-[16px]" : "mt-3 h-12 text-[14px]",
        errors.amount && "ring-2 ring-coral-800",
      )}
    >
      <span className="text-ink/80">{state.currency}</span>
      <input
        inputMode="numeric"
        value={state.other}
        onChange={(e) => {
          dispatch({ type: "other", text: e.target.value.replace(/[^\d,]/g, "").slice(0, 12) });
          setErrors((x) => ({ ...x, amount: "" }));
        }}
        placeholder="OTHER"
        aria-label={`Other amount in ${cur.name.toLowerCase()}`}
        aria-describedby={errId("amount")}
        className="ml-2 min-w-0 flex-1 bg-transparent uppercase placeholder:text-ink/55 focus:outline-none"
      />
      <span className="uppercase text-ink/65">{cur.name}</span>
    </label>
  );

  const cashChoose = (
    <div key="cash" className="animate-[hero-rise_0.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
      <div className={page ? "mt-2.5" : "mt-3"}>
        <Segmented label="Currency" size="sm" skin="vu" value={state.currency} onChange={setCurrency} options={config.currencies.map((c) => ({ value: c.code, label: c.code }))} />
      </div>
      {frequencies.length > 1 ? (
        <div className={page ? "mt-2.5" : "mt-3"}>
          <Segmented label="Frequency" size="sm" skin="vu" value={state.frequency} onChange={(f) => dispatch({ type: "frequency", frequency: f })} options={frequencies} />
        </div>
      ) : (
        <p className="mt-3 flex items-center justify-center gap-2 rounded-full bg-sand py-2.5 font-grotesk text-[12px] font-medium uppercase tracking-[0.04em] text-umber">
          <Heart aria-hidden className="size-3.5" fill="currentColor" strokeWidth={0} /> {FREQUENCY_LABEL[frequencies[0]?.value ?? state.frequency]} gift
        </p>
      )}
      {amountGrid}
      {otherField}
      <FieldError id={`${id("amount")}-err`}>{errors.amount}</FieldError>
      {belowMin && !errors.amount ? (
        <p className="mt-1.5 px-2 font-grotesk text-[13px] text-body">The smallest gift in {cur.code} is {moneyExact(cur.min, cur.code)}.</p>
      ) : null}
      {overMax ? (
        <p className="mt-2 rounded-2xl bg-sand px-4 py-3 font-grotesk text-[13px] leading-snug text-umber">
          For gifts of this size we&rsquo;ll help you give by bank transfer.{" "}
          <a href={config.donationsEmail ? `mailto:${config.donationsEmail}` : routes.contact({ category: "donation" })} className="font-semibold underline underline-offset-2 hover:text-coral-800">
            Contact our team
          </a>
        </p>
      ) : null}
    </div>
  );

  const inKindChoose = (
    <div key="kind" className="mt-4 animate-[hero-rise_0.6s_var(--ease-out-expo)_both] text-left motion-reduce:animate-none">
      <p id={id("items-label")} className="font-grotesk text-[13px] text-ink/75">
        What would you like to give?
      </p>
      <div id={id("items")} tabIndex={-1} className="mt-3 focus:outline-none" aria-describedby={errId("items")}>
        <Chips
          multiple
          tone="coral"
          size="sm"
          label="What would you like to give?"
          value={state.items}
          onChange={(v) => {
            dispatch({ type: "items", items: v as DonateState["items"], touched: true });
            setErrors((x) => ({ ...x, items: "" }));
          }}
          options={config.inKind.map((k) => ({ value: k.value, label: k.label }))}
        />
      </div>
      <FieldError id={`${id("items")}-err`}>{errors.items}</FieldError>
      {state.items.includes("medical_supplies") ? (
        <p className="mt-3 rounded-2xl bg-sand px-4 py-2.5 font-grotesk text-[13px] text-umber">Medical supplies must be sealed and in date.</p>
      ) : null}
      <div className="mt-4 grid gap-3">
        <Field name="description" id={id("description")} label="Describe what you'd like to give" skin="vu" error={errors.description || undefined} counter={{ max: 1000 }}>
          <Textarea
            rows={3}
            maxLength={1000}
            value={state.description}
            onChange={(e) => {
              dispatch({ type: "field", key: "description", value: e.target.value });
              setErrors((x) => ({ ...x, description: "" }));
            }}
            placeholder="For example: 40 school bags with exercise books and pens"
            className="min-h-[96px]"
          />
        </Field>
        <div>
          <p id={id("condition-label")} className="mb-2 font-grotesk text-[13px] font-medium text-ink/75">
            Condition
          </p>
          <div id={id("condition")} tabIndex={-1} className="focus:outline-none" aria-describedby={errId("condition")}>
            <Chips
              tone="coral"
              size="sm"
              label="Condition"
              value={state.condition ?? ""}
              onChange={(v) => {
                dispatch({ type: "condition", value: v as NonNullable<DonateState["condition"]> });
                setErrors((x) => ({ ...x, condition: "" }));
              }}
              options={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))}
            />
          </div>
          <FieldError id={`${id("condition")}-err`}>{errors.condition}</FieldError>
        </div>
        <Field name="handover" id={id("handover")} label="How will the items reach us?" skin="vu" error={errors.handover || undefined}>
          <Select
            value={state.handover ?? ""}
            placeholder="Choose one"
            onChange={(e) => {
              dispatch({ type: "handover", value: e.target.value as DonateState["handover"] & string });
              setErrors((x) => ({ ...x, handover: "" }));
            }}
            options={HANDOVERS.map((h) => ({ value: h.value, label: h.label }))}
          />
        </Field>
        <Field name="location" id={id("location")} label="Town or city" skin="vu" error={errors.location || undefined}>
          <Input
            value={state.location}
            maxLength={80}
            autoComplete="address-level2"
            onChange={(e) => {
              dispatch({ type: "field", key: "location", value: e.target.value });
              setErrors((x) => ({ ...x, location: "" }));
            }}
          />
        </Field>
        <Field name="estValue" id={id("estValue")} label="Estimated value" optional skin="vu" error={errors["estValue.amount"] || undefined}>
          <Input
            inputMode="decimal"
            value={state.estValue}
            onChange={(e) => dispatch({ type: "field", key: "estValue", value: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) })}
            leading={
              <select
                aria-label="Currency of the estimated value"
                value={state.estCurrency}
                onChange={(e) => dispatch({ type: "estCurrency", currency: e.target.value as Currency })}
                className="-ml-1 bg-transparent font-grotesk text-[14px] font-medium text-ink/80 focus:outline-none"
              >
                {config.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            }
          />
        </Field>
      </div>
    </div>
  );

  const ctaClass = (enabled: boolean) =>
    cn(
      "flex items-center justify-center gap-2 rounded-full font-grotesk text-[14px] font-medium uppercase tracking-[0.03em] transition-all duration-300",
      page ? "mt-5 h-14 w-full" : "mx-auto mt-6 h-14 w-[220px]",
      // The page is functional UI (AA): coral-800 under white text; the landing keeps its approved coral.
      enabled ? (page ? "bg-coral-800 text-white hover:bg-night" : "bg-coral text-white hover:bg-night") : "cursor-not-allowed bg-coral/15 text-white",
    );

  /* ── Step bodies ── */
  if (config.unavailable) {
    return (
      <div className={cn("rounded-[30px] bg-white p-6 text-center text-ink shadow-modal sm:p-8", className)}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand text-coral-800">
          <Heart aria-hidden className="size-6" fill="currentColor" strokeWidth={0} />
        </span>
        <p className="mt-4 font-grotesk text-[18px] font-semibold">Our donation form is being set up</p>
        <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-relaxed text-body">
          Thank you for wanting to give. Please{" "}
          <a className="font-bold text-forest underline underline-offset-2" href={config.donationsEmail ? `mailto:${config.donationsEmail}` : routes.contact({ category: "donation" })}>
            {config.donationsEmail ? `email ${config.donationsEmail}` : "contact our team"}
          </a>{" "}
          and we&rsquo;ll help you straight away.
        </p>
      </div>
    );
  }

  const honeypot = (
    <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Company website
        <input ref={honeypotRef} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );

  const anyChoose = state.step === "choose";

  return (
    <div className={cn("relative rounded-[30px] bg-white text-ink shadow-[0_40px_80px_-40px_rgba(6,21,18,0.55)]", page ? "p-5 sm:p-7" : "p-6 sm:p-8", className)}>
      {honeypot}
      {anyChoose ? (
        <>
          {page ? (
            <div className="flex items-center gap-3">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-sand ring-2 ring-white">
                {cause ? <Image src={cause.image.src} alt="" fill sizes="44px" className="object-cover" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <h2 ref={headingRef} tabIndex={-1} className="font-grotesk text-[11px] font-medium uppercase tracking-[0.08em] text-body focus:outline-none">
                  Giving to
                </h2>
                <p className="truncate text-[16px] font-extrabold leading-tight text-ink" aria-live="polite">
                  {causeTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-haspopup="dialog"
                className="h-9 shrink-0 rounded-full border border-mist px-4 font-grotesk text-[12px] font-medium uppercase tracking-[0.04em] text-ink transition-colors hover:border-coral hover:text-coral-800"
              >
                Change<span className="sr-only"> cause</span>
              </button>
            </div>
          ) : (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="text-center font-grotesk text-[18px] font-semibold focus:outline-none">
                Choose Donate
              </h2>
              {causeSlug !== "general" && cause ? (
                <p className="mx-auto mt-2 flex w-fit max-w-full items-center gap-2 rounded-full bg-sand py-1 pl-3.5 pr-1 font-grotesk text-[12.5px] text-umber">
                  <span className="truncate">Giving to: {cause.title}</span>
                  <button type="button" onClick={() => onCauseChange("general")} aria-label="Give where it’s needed most instead" className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-white">
                    <X className="size-3.5" />
                  </button>
                </p>
              ) : null}
            </>
          )}

          <div className={page ? "mt-4" : "mt-5"}>
            <Segmented
              label="Donation type"
              size="sm"
              skin="vu"
              value={state.mode}
              onChange={(m) => {
                dispatch({ type: "mode", mode: m });
                setErrors({});
              }}
              options={[
                { value: "cash", label: "Cash gift" },
                { value: "in_kind", label: "Give in kind" },
              ]}
            />
          </div>

          {state.mode === "cash" ? cashChoose : inKindChoose}

          {page && state.mode === "cash" ? (
            <div aria-live="polite" className="empty:hidden">
              {hint ? (
                <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sand px-4 py-2.5 font-grotesk text-[13px] leading-snug text-umber">
                  <Heart aria-hidden className="mt-0.5 size-3.5 shrink-0 text-coral-800" fill="currentColor" strokeWidth={0} />
                  <span>
                    {hint.below ? (
                      <>
                        From <strong className="font-semibold">{hint.approximate ? "about " : ""}{moneyExact(hint.amount, hint.currency)}</strong>: {hint.label}.
                      </>
                    ) : (
                      <>
                        <strong className="font-semibold">{hint.approximate ? `About ${moneyExact(hint.amount, hint.currency)}` : moneyExact(value, state.currency)}</strong> can provide: {hint.label}.
                      </>
                    )}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {page && state.mode === "cash" && cause && cause.allocation.length > 0 ? <MiniAllocation cause={cause} /> : null}

          {state.mode === "cash" && page ? (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 font-grotesk text-[13.5px] leading-snug text-ink/75">
              <input type="checkbox" checked={state.coverFees} onChange={() => dispatch({ type: "toggle", key: "coverFees" })} className="mt-0.5 size-4 shrink-0 accent-coral" />
              <span>
                Add {percentFmt.format(config.coverFeesPercent)}%{value > 0 ? ` (${moneyExact(fee, state.currency)})` : ""} to cover payment fees, so all of my gift reaches the cause.
              </span>
            </label>
          ) : null}

          {!page ? (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 font-grotesk text-[13.5px] leading-snug text-ink/70">
              <input type="checkbox" checked={state.updates} onChange={() => dispatch({ type: "toggle", key: "updates" })} className="mt-0.5 size-4 shrink-0 accent-coral" />
              {copy.updatesConsentLabel}
            </label>
          ) : null}

          {page ? (
            <button type="button" onClick={goDetails} className={ctaClass(true)}>
              Continue <ArrowRight aria-hidden className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={state.mode === "cash" ? !canContinueCash : state.items.length === 0}
              onClick={goDetails}
              className={ctaClass(state.mode === "cash" ? canContinueCash : state.items.length > 0)}
            >
              {state.mode === "cash" ? "Donate Now" : "Offer Items"}
            </button>
          )}

          {!page && preselected && causeSlug !== "general" ? (
            <p className="mt-4 text-center">
              <Link
                href={routes.donate(causeSlug, { amount: value > 0 ? value : undefined, currency: state.currency, frequency: state.frequency })}
                className="inline-flex items-center gap-1.5 font-grotesk text-[13px] font-medium text-coral-800 underline-offset-4 hover:underline"
              >
                See exactly where it goes <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </p>
          ) : null}
        </>
      ) : null}

      {state.step === "details" ? (
        <form
          noValidate
          className="animate-[hero-rise_0.6s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Turnstile action="donate" />
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "step", step: "choose" });
              setFormMessage(null);
            }}
            className="inline-flex min-h-6 items-center gap-1 font-grotesk text-[12px] uppercase tracking-[0.05em] text-ink/75 hover:text-coral-800"
          >
            <ArrowLeft aria-hidden className="size-3.5" /> Back
          </button>
          <h2 ref={headingRef} tabIndex={-1} className="mt-2 font-grotesk text-[18px] font-semibold focus:outline-none">
            Your details
          </h2>
          <p className="mt-1 font-grotesk text-[13px] font-medium text-coral-800" aria-live="polite">
            {summaryLine(state, causeTitle, frequencyLabel, state.coverFees ? config.coverFeesPercent : 0)}
            {state.ref ? ` · Sponsorship ${state.ref}` : ""}
          </p>

          <div className="mt-4 grid gap-3">
            <Field name="donor.fullName" id={id("donor.fullName")} label="Full name" skin="vu" error={errors["donor.fullName"] || undefined}>
              <Input value={state.donor.fullName} maxLength={120} autoComplete="name" onChange={(e) => dispatch({ type: "donor", patch: { fullName: e.target.value } })} />
            </Field>
            <Field name="donor.email" id={id("donor.email")} label="Email" skin="vu" error={errors["donor.email"] || undefined}>
              <Input type="email" inputMode="email" value={state.donor.email} maxLength={254} autoComplete="email" onChange={(e) => dispatch({ type: "donor", patch: { email: e.target.value } })} />
            </Field>
            <Field name="donor.phone" id={id("donor.phone")} label="Phone" optional skin="vu" error={errors["donor.phone"] || undefined}>
              <Input type="tel" inputMode="tel" value={state.donor.phone} maxLength={24} autoComplete="tel" onChange={(e) => dispatch({ type: "donor", patch: { phone: e.target.value } })} />
            </Field>
            <Field name="donor.country" id={id("donor.country")} label="Country" skin="vu" error={errors["donor.country"] || undefined}>
              <CountrySelect priority={["gm", "us", "gb", "de", "fr", "nl", "se", "ca"]} value={state.donor.country} onChange={(e) => dispatch({ type: "donor", patch: { country: e.target.value } })} />
            </Field>
            <Segmented
              label="Giving as"
              size="sm"
              skin="vu"
              value={state.donor.type}
              onChange={(t) => dispatch({ type: "donor", patch: { type: t } })}
              options={[
                { value: "individual", label: "Individual" },
                { value: "organisation", label: "Organisation" },
              ]}
            />
            {state.donor.type === "organisation" ? (
              <Field name="donor.organisation" id={id("donor.organisation")} label="Organisation name" skin="vu" error={errors["donor.organisation"] || undefined}>
                <Input value={state.donor.organisation} maxLength={150} autoComplete="organization" onChange={(e) => dispatch({ type: "donor", patch: { organisation: e.target.value } })} />
              </Field>
            ) : null}
            {!page ? (
              <Field name="cause" id={id("cause")} label="Preferred programme" skin="vu">
                <Select value={causeSlug} onChange={(e) => onCauseChange(e.target.value)}>
                  <option value="general">{copy.anywhereLabel}</option>
                  <optgroup label="Programmes">
                    {causes
                      .filter((c) => c.kind === "programme" && c.live)
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Seasonal & special appeals">
                    {causes
                      .filter((c) => (c.kind === "appeal" || c.kind === "sponsorship" || c.kind === "project") && c.live)
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                  </optgroup>
                </Select>
              </Field>
            ) : null}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 font-grotesk text-[13.5px] leading-snug text-ink/70">
            <input type="checkbox" checked={state.donor.anonymous} onChange={(e) => dispatch({ type: "donor", patch: { anonymous: e.target.checked } })} className="mt-0.5 size-4 shrink-0 accent-coral" />
            {copy.anonymousLabel}
          </label>
          {page ? (
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 font-grotesk text-[13.5px] leading-snug text-ink/70">
              <input type="checkbox" checked={state.updates} onChange={() => dispatch({ type: "toggle", key: "updates" })} className="mt-0.5 size-4 shrink-0 accent-coral" />
              {copy.updatesConsentLabel}
            </label>
          ) : null}
          {!page && state.mode === "cash" ? (
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 font-grotesk text-[13.5px] leading-snug text-ink/70">
              <input type="checkbox" checked={state.coverFees} onChange={() => dispatch({ type: "toggle", key: "coverFees" })} className="mt-0.5 size-4 shrink-0 accent-coral" />
              <span>
                Add {percentFmt.format(config.coverFeesPercent)}% ({moneyExact(fee, state.currency)}) to cover payment fees, so all of my gift reaches the cause.
              </span>
            </label>
          ) : null}

          {state.donor.showComments ? (
            <Field name="donor.comments" id={id("donor.comments")} label="A note for our team" optional skin="vu" className="mt-3" counter={{ max: 500 }} error={errors["donor.comments"] || undefined}>
              <Textarea rows={3} maxLength={500} value={state.donor.comments} onChange={(e) => dispatch({ type: "donor", patch: { comments: e.target.value } })} className="min-h-[88px]" />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: "donor", patch: { showComments: true } })}
              className="mt-3 inline-flex min-h-6 items-center gap-1.5 font-grotesk text-[13px] font-medium text-ink/70 hover:text-coral-800"
            >
              <Plus aria-hidden className="size-3.5" /> Add a note (optional)
            </button>
          )}

          {state.mode === "cash" && route === "local" && methods.length > 1 ? (
            <div className="mt-4">
              <p className="mb-2 font-grotesk text-[13px] font-medium text-ink/75">How would you like to pay?</p>
              <Chips tone="coral" size="sm" label="How would you like to pay?" value={state.method ?? methods[0].id} onChange={(v) => dispatch({ type: "method", method: v as NonNullable<DonateState["method"]> })} options={methods.map((m) => ({ value: m.id, label: m.label }))} />
            </div>
          ) : null}

          {formMessage ? (
            <div role="alert" className={cn("mt-4 rounded-2xl px-4 py-3 font-grotesk text-[13.5px] leading-snug", formMessage.unavailable ? "bg-sand text-umber" : "bg-coral-100 text-coral-800")}>
              <p className="flex items-start gap-2">
                <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
                <span>
                  {formMessage.text}
                  {formMessage.offerPledge ? (
                    <>
                      {" "}
                      <button type="button" onClick={() => void submit({ pledgeInstead: true })} className="font-semibold underline underline-offset-2">
                        Pledge now and pay later
                      </button>
                    </>
                  ) : null}
                  {formMessage.unavailable ? (
                    <>
                      {" "}
                      <a href={config.donationsEmail ? `mailto:${config.donationsEmail}` : routes.contact({ category: "donation" })} className="font-semibold underline underline-offset-2">
                        {config.donationsEmail || "Contact our team"}
                      </a>
                    </>
                  ) : null}
                </span>
              </p>
            </div>
          ) : null}

          <button type="submit" aria-busy={pending || undefined} disabled={pending} className={cn(ctaClass(!pending), pending && "cursor-progress")}>
            {pending ? (
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : state.mode === "cash" && route === "stripe" ? (
              <Lock aria-hidden className="size-4" />
            ) : (
              <Heart aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
            )}
            {state.mode === "in_kind" ? "Offer My Items" : route === "stripe" ? "Continue to Secure Payment" : "Confirm My Pledge"}
          </button>
          <p className="mt-3 text-center font-grotesk text-[12.5px] leading-snug text-body">
            {state.mode === "in_kind"
              ? "We'll email you to arrange how your items reach us."
              : route === "stripe"
                ? "You'll pay on Stripe's secure page. We never store card details on this site."
                : `We'll email you how to pay${methods.length ? ` (${methods.map((m) => m.label.replace(/^Card: .*/, "card link")).join(", ")})` : ""}.`}
          </p>
          {state.mode === "cash" && !anyCard ? (
            <p className="mt-3 rounded-2xl bg-cream px-4 py-2.5 text-center font-grotesk text-[12.5px] leading-snug text-umber">
              Online card payments are being set up. Pledge now and we&rsquo;ll email you secure payment details.
            </p>
          ) : null}
          {config.pledgeBadge && state.mode === "cash" ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 font-grotesk text-[11px] font-semibold uppercase tracking-[0.06em] text-body">
              <Sparkles aria-hidden className="size-3" /> Stripe not configured: pledge mode
            </p>
          ) : null}
        </form>
      ) : null}

      {state.step === "redirecting" ? (
        <div className="py-8 text-center" role="status">
          <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-coral text-white">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-coral motion-reduce:hidden" />
            <Heart className="relative size-7 animate-heartbeat motion-reduce:animate-none" fill="currentColor" strokeWidth={0} />
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="mt-5 font-grotesk text-[18px] font-semibold focus:outline-none">
            Taking you to secure payment…
          </h2>
          <p className="mt-2 font-grotesk text-[13px] text-body">Please don&rsquo;t close this page.</p>
        </div>
      ) : null}

      {state.step !== "redirecting" ? (
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center font-grotesk text-[11.5px] text-ink/65">
          <Lock className="size-3" aria-hidden /> {copy.securityNote}
        </p>
      ) : null}

      {page ? <CausePicker open={pickerOpen} onClose={() => setPickerOpen(false)} causes={causes} current={causeSlug} onPick={(slug) => {
        setPickerOpen(false);
        if (slug !== causeSlug) onCauseChange(slug);
      }} /> : null}
    </div>
  );
}

/** A compact 6px stacked bar of the cause's split, with a three-item legend and the full-breakdown link. */
function MiniAllocation({ cause }: { cause: WidgetCause }) {
  const fills: Record<string, string> = {
    forest: "bg-forest",
    marigold: "bg-marigold",
    clay: "bg-clay",
    cocoa: "bg-cocoa",
    coral: "bg-coral-800",
    umber: "bg-umber",
    deep: "bg-deep",
  };
  const order = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"];
  const parts = cause.allocation.map((p, i) => ({ ...p, tone: p.tone ?? order[i % order.length] }));
  const top = [...parts].sort((a, b) => b.percent - a.percent).slice(0, 2);
  const rest = 100 - top.reduce((s, p) => s + p.percent, 0);
  const legend = [...top.map((p) => `${plainNumber.format(p.percent)}% ${p.label.toLowerCase()}`), ...(rest > 0.5 ? [`${plainNumber.format(rest)}% other`] : [])];
  const scale = Math.max(100, parts.reduce((s, p) => s + p.percent, 0));
  return (
    <div className="mt-3 rounded-2xl border border-mist px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 whitespace-nowrap font-grotesk text-[11px] font-medium uppercase tracking-[0.08em] text-body">
          Where it goes
          {!cause.verified ? <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-umber">Illustrative</span> : null}
        </p>
        <AnchorLink to="where-it-goes" className="inline-flex shrink-0 items-center gap-1 font-grotesk text-[12px] font-semibold text-coral-800 underline-offset-4 hover:underline">
          Full breakdown <ArrowRight aria-hidden className="size-3" />
        </AnchorLink>
      </div>
      {cause.showFigures ? (
        <>
          <div aria-hidden className="mt-2 flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-pebble">
            {parts.map((p, i) => (
              <span key={`${p.label}-${i}`} className={cn("h-full first:rounded-l-full last:rounded-r-full", fills[p.tone])} style={{ width: `${(p.percent / scale) * 100}%` }} />
            ))}
          </div>
          <p className="mt-1.5 truncate font-grotesk text-[12.5px] leading-snug text-ink/80">{legend.join(" · ")}</p>
        </>
      ) : (
        <p className="mt-1.5 truncate font-grotesk text-[12.5px] leading-snug text-ink/80">{parts.slice(0, 3).map((p) => p.label).join(" · ")}</p>
      )}
    </div>
  );
}

