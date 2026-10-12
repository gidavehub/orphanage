"use client";

import Link from "next/link";
import { Suspense, startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageCircleQuestion, ShieldAlert, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Chips } from "@/components/ui/form/Chips";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field } from "@/components/ui/form/Field";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { FileDrop, type UploadItem } from "@/components/ui/form/FileDrop";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { MoneyField } from "@/components/ui/form/MoneyField";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { RadioCards, type RadioCardOption } from "@/components/ui/form/RadioCards";
import { Select } from "@/components/ui/form/Select";
import { Stepper } from "@/components/ui/form/Stepper";
import { Textarea } from "@/components/ui/form/Textarea";
import { useStepper } from "@/components/ui/form/useStepper";
import { IDLE, type FieldErrors, type FormState } from "@/lib/forms/types";
import { PRESENCE_FIRST, countryName } from "@/lib/countries";
import { CURRENCIES, isSupportFormCategory, type SupportFormCategory } from "@/lib/model/enums";
import { AGE_BAND_LABEL, CONTACT_METHOD_LABEL, RELATIONSHIP_LABEL, SUPPORT_FORM_CATEGORY_LABEL, URGENCY3_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import {
  COUNSELLING_FOR,
  DAY_PERIODS,
  EDUCATION_LEVELS,
  EDUCATION_NEEDS,
  EXPLANATION_MAX,
  LEGAL_MATTERS,
  LEGAL_MAX_UPLOADS,
  MAX_UPLOADS,
  MEDICAL_NEEDS,
  SUPPORT_AGE_BANDS,
  SUPPORT_RELATIONSHIPS,
  SUPPORT_STEPS,
  WEEKDAYS,
  validateSupportStep,
} from "@/lib/schemas/forms/support";
import type { SupportSuccess } from "@/lib/server/intake/support";
import { ChoicePills } from "./ChoicePills";
import { EmergencyBlock, type EmergencyContact } from "./EmergencyBlock";
import { failureMessage, first, firstStepWithError, list, maskEmail, pickErrors, readForm, type RawValues } from "./form-utils";
import {
  COUNSELLING_FOR_LABEL,
  DAY_PERIOD_LABEL,
  EDUCATION_LEVEL_LABEL,
  EDUCATION_NEED_LABEL,
  LEGAL_MATTER_LABEL,
  MEDICAL_NEED_LABEL,
  SAFE_TO_CONTACT_LABEL,
  SUPPORT_CATEGORY_DESCRIPTION,
  VIDEO_COMFORT_LABEL,
  WEEKDAY_LABEL,
} from "./labels";
import { QueryPrefill } from "./QueryPrefill";
import { ReviewSummary, type ReviewGroup } from "./ReviewSummary";
import { StepNav } from "./StepNav";
import { useLeaveGuard } from "./useLeaveGuard";

type State = FormState<string, SupportSuccess>;

export type SupportRequestFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  /** `/api/uploads`, or null when storage is not connected (FileDrop shows "we'll ask securely"). */
  uploadUrl: string | null;
  counsellingOpen: boolean;
  contact: { phone: string; phoneHref: string; email: string };
  safety: { text: string; contacts: EmergencyContact[] };
  responseTime: string;
  copy: {
    explanationHint: string;
    documentsHint: string;
    reviewNote: string;
    successTitle: string;
    successNote: string;
    nextSteps: Array<{ title: string; body?: string }>;
    medicalDisclaimer: string;
    legalDisclaimer: string;
    counsellingDisclaimer: string;
  };
};

const CATEGORY_DESCRIPTION: Record<SupportFormCategory, string> = SUPPORT_CATEGORY_DESCRIPTION;

const CATEGORY_ORDER: SupportFormCategory[] = ["child_protection", "education", "medical", "counselling", "legal", "food_supplies", "family_support", "other"];

const CATEGORY_ICON: Record<SupportFormCategory, RadioCardOption["icon"]> = {
  child_protection: ShieldAlert,
  education: "education",
  medical: "medical",
  counselling: "psychological",
  legal: "legal",
  food_supplies: ShoppingBasket,
  family_support: "family",
  other: MessageCircleQuestion,
};

/** Older links used hyphens (`?type=child-protection`). */
function categoryFromUrl(v: string): SupportFormCategory | null {
  const t = v.trim().toLowerCase().replace(/-/g, "_");
  return isSupportFormCategory(t) ? t : null;
}

const DANGER_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

const opt = <K extends string>(labels: Record<K, string>, keys: readonly K[]) => keys.map((k) => ({ value: k, label: labels[k] }));

function headingId(step: number) {
  return `sr-step-${step}`;
}

export function SupportRequestForm({ action, uploadUrl, counsellingOpen, contact, safety, responseTime, copy }: SupportRequestFormProps) {
  const [state, dispatch, pending] = useActionState<State, FormData>(action, IDLE as State);
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const touched = useRef(new Set<string>());
  const focusSummary = useRef(false);
  const lastState = useRef<State>(state);
  const uid = useId();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusKey, setFocusKey] = useState(0);
  const [formMessage, setFormMessage] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<RawValues>({});

  const [category, setCategory] = useState<SupportFormCategory | "">("");
  const [cpContinue, setCpContinue] = useState(false);
  const [urgency, setUrgency] = useState("");
  const [danger, setDanger] = useState("");
  const [relationship, setRelationship] = useState("");
  const [preferred, setPreferred] = useState("");
  const [safe, setSafe] = useState("");
  const [counsellingFor, setCounsellingFor] = useState("");
  const [video, setVideo] = useState("");
  const [medicalNeed, setMedicalNeed] = useState("");
  const [legalMatter, setLegalMatter] = useState("");

  const success = state.status === "success" ? state : null;
  useLeaveGuard(dirty && !success);

  const validate = useCallback(
    (step: number): boolean => {
      const raw = readForm(formRef.current);
      const errs = validateSupportStep(step, raw);
      if (step === 0 && raw.category === "child_protection" && !cpContinue) {
        errs.category = "Please choose Report a concern, or tell us you need support or guidance to continue.";
      }
      if (step === 1 && uploading) errs.upload = "Please wait until your files have finished uploading.";
      const fields = SUPPORT_STEPS[step]?.fields ?? [];
      setErrors((prev) => {
        const next: FieldErrors = { ...prev };
        for (const f of fields) delete next[f];
        return { ...next, ...errs };
      });
      setFormMessage(undefined);
      const ok = Object.keys(errs).length === 0;
      if (!ok) setFocusKey((k) => k + 1);
      else if (step === SUPPORT_STEPS.length - 2) setReview(raw);
      return ok;
    },
    [cpContinue, uploading],
  );

  const stepper = useStepper({ count: SUPPORT_STEPS.length, validate, headingId });
  const { step, goTo } = stepper;

  // A server answer. Errors are taken into state while rendering (no effect round-trip); the effect
  // only moves to the first step that holds one, or scrolls the success screen into view.
  const [seenState, setSeenState] = useState<State>(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error") {
      const fieldErrors = (state.fieldErrors ?? {}) as FieldErrors;
      setErrors(fieldErrors);
      setFormMessage(failureMessage(state, { phone: contact.phone, email: contact.email, noun: "request" }));
      const target = firstStepWithError(fieldErrors, SUPPORT_STEPS);
      if (target < 0 || target === step) setFocusKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.status === "success") {
      cardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    if (state.status !== "error") return;
    const target = firstStepWithError((state.fieldErrors ?? {}) as FieldErrors, SUPPORT_STEPS);
    if (target >= 0 && target !== step) {
      focusSummary.current = true;
      void goTo(target);
    }
  }, [state, step, goTo]);

  useEffect(() => {
    if (!focusSummary.current) return;
    focusSummary.current = false;
    const t = window.setTimeout(() => summaryRef.current?.querySelector<HTMLElement>('[role="group"]')?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [step]);

  const onPrefill = useCallback((v: Record<string, string>) => {
    const c = v.type ? categoryFromUrl(v.type) : null;
    if (!c) return;
    if (c === "counselling" && !counsellingOpen) return;
    setCategory((cur) => cur || c);
  }, [counsellingOpen]);

  /** Re-checks fields that currently show an error, so fixing one clears it straight away. */
  const refresh = useCallback(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => prev[k] && k !== "_form");
      if (!keys.length) return prev;
      const errs = validateSupportStep(step, readForm(formRef.current));
      const fields = SUPPORT_STEPS[step]?.fields ?? [];
      const next: FieldErrors = { ...prev };
      for (const k of keys) {
        if (!fields.includes(k as never)) continue;
        if (errs[k]) next[k] = errs[k];
        else delete next[k];
      }
      return next;
    });
  }, [step]);

  const onBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const name = (e.target as EventTarget & { name?: string }).name;
    if (!name || !touched.current.has(name)) return;
    const errs = validateSupportStep(step, readForm(formRef.current));
    setErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (errs[name]) next[name] = errs[name];
      else delete next[name];
      return next;
    });
  };

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    const name = (e.target as EventTarget & { name?: string }).name;
    if (name) touched.current.add(name);
    if (!dirty) setDirty(true);
    refresh();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!stepper.isLast) {
      void stepper.next();
      return;
    }
    for (let s = 0; s < SUPPORT_STEPS.length; s++) {
      if (!validate(s)) {
        if (s !== step) {
          focusSummary.current = true;
          void goTo(s);
        }
        return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setFormMessage("You seem to be offline. Your answers are safe on this page; reconnect and press Send again.");
      setFocusKey((k) => k + 1);
      return;
    }
    const fd = new FormData(e.currentTarget);
    if (fd.get("category") === "counselling") {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) fd.set("timezone", tz);
      } catch {
        /* no time zone: the counsellor asks */
      }
    }
    startTransition(() => dispatch(fd));
  };

  const onFiles = useCallback((items: UploadItem[]) => {
    setUploading(items.some((i) => i.status === "uploading" || i.status === "preparing"));
  }, []);

  if (success) {
    const masked = success.data?.emailSent ? maskEmail(first(review.email)) : null;
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          title={copy.successTitle}
          reference={success.reference}
          message={
            <>
              <p>{copy.successNote}</p>
              <p className="mt-2">We aim to reply within {responseTime}.</p>
              {masked ? <p className="mt-2">A confirmation has been sent to {masked}.</p> : null}
            </>
          }
          next={copy.nextSteps.map((s) => ({ title: s.title, body: s.body }))}
          actions={
            <>
              <Button href={routes.home} variant="forest" icon="none">
                Back to Home
              </Button>
              <Button href={routes.resources()} variant="outline">
                Explore Support Resources
              </Button>
            </>
          }
        />
        <EmergencyBlock text={safety.text} contacts={safety.contacts} className="mt-10" />
      </div>
    );
  }

  const stepErrors = (s: number) => pickErrors(errors, SUPPORT_STEPS[s]?.fields ?? []);
  const err = (name: string) => errors[name];
  const categoryOptions: RadioCardOption[] = CATEGORY_ORDER.map((c) => ({
    value: c,
    label: SUPPORT_FORM_CATEGORY_LABEL[c],
    description: CATEGORY_DESCRIPTION[c],
    icon: CATEGORY_ICON[c],
    ...(c === "child_protection" ? { tone: "urgent" as const } : {}),
    ...(c === "counselling" && !counsellingOpen ? { disabled: true, meta: "Paused for now. Please call or email us." } : {}),
  }));

  const showFiles = category === "education" || category === "medical" || category === "legal";
  const reviewGroups: ReviewGroup[] = buildReview(review);

  return (
    <div ref={cardRef} className="scroll-mt-28">
      <Suspense fallback={null}>
        <QueryPrefill keys={["type"]} onValues={onPrefill} />
      </Suspense>
      <Stepper steps={SUPPORT_STEPS.map((s) => ({ id: s.id, label: s.label }))} current={step} onStepClick={(i) => void goTo(i)} />

      <form ref={formRef} noValidate onSubmit={onSubmit} onBlur={onBlur} onChange={onChange} aria-describedby={`${uid}-required`} className="relative mt-8">
        <p id={`${uid}-required`} className="sr-only">
          Every question is required unless it says optional.
        </p>
        <Honeypot />
        <Turnstile action="support" />
        <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <div ref={summaryRef}>
            <ErrorSummary errors={stepErrors(step)} message={formMessage} focusKey={focusKey} className="mb-8" />
          </div>

          {/* Step 1: what do you need help with? */}
          <section hidden={step !== 0} aria-labelledby={headingId(0)}>
            <StepHeading step={0} />
            <div className="mt-7 grid gap-9">
              <div className="grid gap-4">
                <RadioCards
                  name="category"
                  legend="Type of support"
                  hint="Choose the one that fits best. You can explain more on the next step."
                  options={categoryOptions}
                  value={category}
                  onChange={(v) => {
                    setCategory(v as SupportFormCategory);
                    if (v !== "child_protection") setCpContinue(false);
                  }}
                  error={err("category")}
                  columns={2}
                />
                {category === "child_protection" ? (
                  <div role="status" className="animate-[hero-rise_0.6s_var(--ease-out-expo)_both] rounded-control border-2 border-coral-800 bg-coral-100 p-5 motion-reduce:animate-none sm:p-6">
                    <p className="flex items-start gap-2.5 text-[16px] font-extrabold leading-snug text-coral-800">
                      <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.5} />
                      Is a child being harmed or at risk of harm right now?
                    </p>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">Please use our confidential concern form instead. It goes straight to our safeguarding team.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button href={routes.concern()} variant="flame-ink" icon="arrow-right">
                        Report a concern
                      </Button>
                      <Button variant={cpContinue ? "forest" : "outline"} icon="none" onClick={() => setCpContinue(true)} aria-pressed={cpContinue}>
                        I need support or guidance – continue
                      </Button>
                    </div>
                    {cpContinue ? (
                      <p className="mt-3 text-[14px] font-semibold text-forest-700">Thank you. Carry on below: your request will be read by trained safeguarding staff.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ChoicePills
                name="urgency"
                legend="How urgent is this?"
                options={opt(URGENCY3_LABEL, ["low", "medium", "high"] as const)}
                value={urgency as never}
                onChange={(v) => setUrgency(v)}
                error={err("urgency")}
                stack
              />

              <div className="grid gap-4">
                <ChoicePills
                  name="immediateDanger"
                  legend="Is anyone in immediate danger?"
                  options={DANGER_OPTIONS}
                  value={danger as never}
                  onChange={(v) => setDanger(v)}
                  error={err("immediateDanger")}
                  urgentValue="yes"
                />
                {danger === "yes" ? (
                  <EmergencyBlock
                    live
                    text={safety.text}
                    contacts={safety.contacts}
                    action={
                      <div className="flex flex-col gap-3">
                        <Button href={routes.concern()} variant="marigold-ink" size="sm" icon="arrow-right">
                          Report a concern
                        </Button>
                        <p className="text-[14px] text-white/85">You can still send this request. We will treat it as urgent.</p>
                      </div>
                    }
                  />
                ) : null}
              </div>
            </div>
          </section>

          {/* Step 2: tell us what's happening */}
          <section hidden={step !== 1} aria-labelledby={headingId(1)}>
            <StepHeading step={1} />
            <div className="mt-7 grid gap-7">
              <Field name="explanation" label="Brief explanation" hint={copy.explanationHint} error={err("explanation")} counter={{ max: EXPLANATION_MAX }}>
                <Textarea rows={6} maxLength={EXPLANATION_MAX + 200} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="childAge" label="The child's age" optional error={err("childAge")}>
                  <Select placeholder="Choose an age range" defaultValue="" options={SUPPORT_AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABEL[a] }))} />
                </Field>
                <Field name="childrenCount" label="How many children need help?" optional error={err("childrenCount")}>
                  <Input inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} />
                </Field>
              </div>

              {category === "education" ? (
                <Extras title="About school">
                  <Field name="educationLevel" label="School level" optional error={err("educationLevel")}>
                    <Select placeholder="Choose a level" defaultValue="" options={opt(EDUCATION_LEVEL_LABEL, EDUCATION_LEVELS)} />
                  </Field>
                  <Fieldset name="educationNeeds" legend="What is needed?" hint="Choose any that apply (optional)." size="sm" error={err("educationNeeds")}>
                    <Chips multiple name="educationNeeds" tone="coral" label="What is needed" options={opt(EDUCATION_NEED_LABEL, EDUCATION_NEEDS)} onChange={() => setDirty(true)} />
                  </Fieldset>
                  <Field name="amountNeeded" label="Approximate amount needed" optional hint="A rough figure is fine." error={err("amountNeeded")}>
                    <MoneyField name="amountNeeded" currencies={CURRENCIES} defaultCurrency="GMD" />
                  </Field>
                </Extras>
              ) : null}

              {category === "medical" ? (
                <Extras title="About the medical need">
                  <ChoicePills
                    name="medicalNeed"
                    legend="What kind of help? (optional)"
                    options={opt(MEDICAL_NEED_LABEL, MEDICAL_NEEDS)}
                    value={medicalNeed as never}
                    onChange={(v) => setMedicalNeed(v)}
                    error={err("medicalNeed")}
                    stack
                  />
                  <Notice tone="disclaimer" compact>
                    {copy.medicalDisclaimer}
                  </Notice>
                </Extras>
              ) : null}

              {category === "counselling" ? (
                <Extras title="Counselling preferences">
                  <ChoicePills
                    name="counsellingFor"
                    legend="Who is the support for? (optional)"
                    options={opt(COUNSELLING_FOR_LABEL, COUNSELLING_FOR)}
                    value={counsellingFor as never}
                    onChange={(v) => setCounsellingFor(v)}
                    error={err("counsellingFor")}
                  />
                  <Field name="counsellingLanguage" label="Preferred language" optional hint="For example Wolof, French, Arabic, Hindi or English." error={err("counsellingLanguage")}>
                    <Input autoComplete="off" maxLength={40} />
                  </Field>
                  <Fieldset name="counsellingDays" legend="Days that suit you" hint="Choose any (optional)." size="sm" error={err("counsellingDays")}>
                    <Chips multiple name="counsellingDays" tone="coral" label="Days that suit you" options={opt(WEEKDAY_LABEL, WEEKDAYS)} onChange={() => setDirty(true)} />
                  </Fieldset>
                  <Fieldset name="counsellingPeriods" legend="Times that suit you" hint="Choose any (optional)." size="sm" error={err("counsellingPeriods")}>
                    <Chips multiple name="counsellingPeriods" tone="coral" label="Times that suit you" options={opt(DAY_PERIOD_LABEL, DAY_PERIODS)} onChange={() => setDirty(true)} />
                  </Fieldset>
                  <ChoicePills
                    name="counsellingVideo"
                    legend="Are you comfortable with a video call? (optional)"
                    options={opt(VIDEO_COMFORT_LABEL, ["yes", "no", "unsure"] as const)}
                    value={video as never}
                    onChange={(v) => setVideo(v)}
                    error={err("counsellingVideo")}
                  />
                  <Field name="counsellingTimes" label="Anything else about times?" optional error={err("counsellingTimes")}>
                    <Input autoComplete="off" maxLength={200} />
                  </Field>
                  <Notice tone="disclaimer" compact>
                    {copy.counsellingDisclaimer}
                  </Notice>
                </Extras>
              ) : null}

              {category === "legal" ? (
                <Extras title="About the legal matter">
                  <ChoicePills
                    name="legalMatter"
                    legend="What is it about? (optional)"
                    options={opt(LEGAL_MATTER_LABEL, LEGAL_MATTERS)}
                    value={legalMatter as never}
                    onChange={(v) => setLegalMatter(v)}
                    error={err("legalMatter")}
                    stack
                  />
                  <Notice tone="disclaimer" compact>
                    {copy.legalDisclaimer}
                  </Notice>
                </Extras>
              ) : null}

              {category === "food_supplies" ? (
                <Extras title="About your household">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field name="householdSize" label="People in the household" optional error={err("householdSize")}>
                      <Input inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} />
                    </Field>
                    <Field name="childrenInHousehold" label="Children in the household" optional error={err("childrenInHousehold")}>
                      <Input inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} />
                    </Field>
                  </div>
                </Extras>
              ) : null}

              {showFiles ? (
                <Field name="upload" label="Supporting documents" optional hint={copy.documentsHint} error={err("upload")}>
                  <FileDrop
                    key={category}
                    uploadUrl={uploadUrl}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    maxSizeMb={4}
                    maxFiles={category === "legal" ? LEGAL_MAX_UPLOADS : MAX_UPLOADS}
                    sensitive
                    onFiles={onFiles}
                  />
                </Field>
              ) : null}
            </div>
          </section>

          {/* Step 3: about you */}
          <section hidden={step !== 2} aria-labelledby={headingId(2)}>
            <StepHeading step={2} />
            <div className="mt-7 grid gap-7">
              <Field name="fullName" label="Your full name" error={err("fullName")}>
                <Input autoComplete="name" maxLength={120} />
              </Field>
              <div className="grid gap-4">
                <Field name="relationship" label="Your relationship to the child" error={err("relationship")}>
                  <Select
                    placeholder="Choose one"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    options={SUPPORT_RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))}
                  />
                </Field>
                {relationship === "other" ? (
                  <Field name="relationshipOther" label="Please tell us your relationship" error={err("relationshipOther")}>
                    <Input autoComplete="off" maxLength={60} />
                  </Field>
                ) : null}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="phone" label="Phone" optional hint="With the country code, like +220." error={err("phone")}>
                  <PhoneInput maxLength={30} />
                </Field>
                <Field name="email" label="Email" optional hint="We'll send your reference here." error={err("email")}>
                  <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} />
                </Field>
              </div>
              <p className="-mt-3 text-[14px] leading-relaxed text-body">Please give a phone number, an email, or both, so we can reach you.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="country" label="Country" error={err("country")}>
                  <CountrySelect priority={PRESENCE_FIRST} />
                </Field>
                <Field name="locality" label="Town or area" optional hint="The general area only, never a street address." error={err("locality")}>
                  <Input autoComplete="address-level2" maxLength={80} />
                </Field>
              </div>
              <ChoicePills
                name="preferredContact"
                legend="How should we contact you?"
                options={(["phone", "whatsapp", "sms", "email"] as const).map((m) => ({ value: m, label: CONTACT_METHOD_LABEL[m] }))}
                value={preferred as never}
                onChange={(v) => setPreferred(v)}
                error={err("preferredContact")}
              />
              <div className="grid gap-4">
                <ChoicePills
                  name="safeToContact"
                  legend="Is it safe for us to contact you on these details?"
                  options={opt(SAFE_TO_CONTACT_LABEL, ["yes", "careful"] as const)}
                  value={safe as never}
                  onChange={(v) => setSafe(v)}
                  error={err("safeToContact")}
                />
                {safe === "careful" ? (
                  <Field name="bestTimes" label="Best time or way to reach you safely" hint="For example: only on weekday mornings, or send an SMS first." error={err("bestTimes")}>
                    <Input autoComplete="off" maxLength={120} />
                  </Field>
                ) : null}
              </div>
            </div>
          </section>

          {/* Step 4: review and send */}
          <section hidden={step !== 3} aria-labelledby={headingId(3)}>
            <StepHeading step={3} />
            <div className="mt-7 grid gap-7">
              <ReviewSummary groups={reviewGroups} onEdit={(s) => void goTo(s)} />
              <div className="grid gap-4 rounded-control bg-paper p-5 sm:p-6">
                <Checkbox name="consentToContact" label="I agree that Haven may contact me about this request using the details I've given." error={err("consentToContact")} />
                <Checkbox
                  name="privacyAcknowledged"
                  label={
                    <>
                      I have read the <Link href={routes.policy("privacy")}>Privacy Policy</Link> and understand how my information is used and protected.
                    </>
                  }
                  error={err("privacyAcknowledged")}
                />
              </div>
              <Notice tone="info" compact>
                {copy.reviewNote}
              </Notice>
            </div>
          </section>

          <StepNav
            isFirst={stepper.isFirst}
            isLast={stepper.isLast}
            onBack={stepper.back}
            onNext={() => void stepper.next()}
            submitLabel="Send My Request"
            pendingLabel="Sending securely…"
            pending={pending}
            busy={uploading}
            busyLabel="Uploading…"
            aboveQuickExit
          />
        </fieldset>
      </form>
    </div>
  );

  function buildReview(v: RawValues): ReviewGroup[] {
    const cat = first(v.category);
    const catLabel = isSupportFormCategory(cat) ? SUPPORT_FORM_CATEGORY_LABEL[cat] : "";
    const urg = first(v.urgency);
    const extras: string[] = [];
    if (cat === "education") {
      const lvl = first(v.educationLevel);
      if (lvl) extras.push(EDUCATION_LEVEL_LABEL[lvl as keyof typeof EDUCATION_LEVEL_LABEL] ?? lvl);
      const needs = list(v.educationNeeds).map((n) => EDUCATION_NEED_LABEL[n as keyof typeof EDUCATION_NEED_LABEL] ?? n);
      if (needs.length) extras.push(needs.join(", "));
      const minor = first(v.amountNeeded);
      if (minor) extras.push(`About ${first(v.amountNeededCurrency)} ${(Number(minor) / 100).toLocaleString("en")}`);
    }
    if (cat === "medical" && first(v.medicalNeed)) extras.push(MEDICAL_NEED_LABEL[first(v.medicalNeed) as keyof typeof MEDICAL_NEED_LABEL] ?? "");
    if (cat === "legal" && first(v.legalMatter)) extras.push(LEGAL_MATTER_LABEL[first(v.legalMatter) as keyof typeof LEGAL_MATTER_LABEL] ?? "");
    if (cat === "counselling") {
      const who = first(v.counsellingFor);
      if (who) extras.push(`For ${COUNSELLING_FOR_LABEL[who as keyof typeof COUNSELLING_FOR_LABEL]?.toLowerCase() ?? who}`);
      if (first(v.counsellingLanguage)) extras.push(`In ${first(v.counsellingLanguage)}`);
      const days = list(v.counsellingDays).map((d) => WEEKDAY_LABEL[d as keyof typeof WEEKDAY_LABEL] ?? d);
      const periods = list(v.counsellingPeriods).map((p) => DAY_PERIOD_LABEL[p as keyof typeof DAY_PERIOD_LABEL]?.toLowerCase() ?? p);
      if (days.length || periods.length) extras.push([days.join(", "), periods.join(" or ")].filter(Boolean).join(", "));
      const vid = first(v.counsellingVideo);
      if (vid) extras.push(`Video call: ${VIDEO_COMFORT_LABEL[vid as keyof typeof VIDEO_COMFORT_LABEL]?.toLowerCase() ?? vid}`);
    }
    if (cat === "food_supplies") {
      if (first(v.householdSize)) extras.push(`${first(v.householdSize)} people at home`);
      if (first(v.childrenInHousehold)) extras.push(`${first(v.childrenInHousehold)} children`);
    }
    const files = list(v.upload).length;
    const age = first(v.childAge);
    const rel = first(v.relationship);
    const method = first(v.preferredContact);
    const safeAns = first(v.safeToContact);
    const country = first(v.country);
    return [
      {
        step: 0,
        title: "Your need",
        rows: [
          { label: "Type of support", value: catLabel },
          { label: "Urgency", value: urg ? URGENCY3_LABEL[urg as keyof typeof URGENCY3_LABEL] : "" },
          { label: "Immediate danger", value: first(v.immediateDanger) === "yes" ? "Yes" : first(v.immediateDanger) === "no" ? "No" : "" },
        ],
      },
      {
        step: 1,
        title: "What's happening",
        rows: [
          { label: "Explanation", value: first(v.explanation) },
          { label: "Child's age", value: age ? AGE_BAND_LABEL[age as keyof typeof AGE_BAND_LABEL] : "" },
          { label: "Children needing help", value: first(v.childrenCount) },
          ...(extras.length ? [{ label: "Details", value: extras.filter(Boolean).join(" · ") }] : []),
          ...(showFiles ? [{ label: "Documents", value: files ? `${files} attached` : "" }] : []),
        ],
      },
      {
        step: 2,
        title: "About you",
        rows: [
          { label: "Name", value: first(v.fullName) },
          { label: "Relationship", value: rel === "other" ? first(v.relationshipOther) : rel ? RELATIONSHIP_LABEL[rel as keyof typeof RELATIONSHIP_LABEL] : "" },
          { label: "Phone", value: first(v.phone) },
          { label: "Email", value: first(v.email) },
          { label: "Where", value: [first(v.locality), country === "other" ? "Other country" : country ? countryName(country) : ""].filter(Boolean).join(", ") },
          { label: "Contact by", value: method ? CONTACT_METHOD_LABEL[method as keyof typeof CONTACT_METHOD_LABEL] : "" },
          {
            label: "Safe to contact",
            value: safeAns === "careful" ? `Please be careful. ${first(v.bestTimes)}`.trim() : safeAns ? SAFE_TO_CONTACT_LABEL[safeAns as keyof typeof SAFE_TO_CONTACT_LABEL] : "",
          },
        ],
      },
    ];
  }
}

function StepHeading({ step }: { step: number }) {
  const s = SUPPORT_STEPS[step];
  return (
    <h2 id={headingId(step)} tabIndex={-1} className="scroll-mt-32 text-[24px] font-extrabold leading-tight text-ink outline-offset-8 focus-forest md:text-[28px]">
      {s?.title}
      <span aria-hidden className="mt-3 block h-[2px] w-12 bg-marigold" />
    </h2>
  );
}

function Extras({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-6 rounded-control border border-marigold-line bg-cream p-5 sm:p-6">
      <p className="font-script text-[24px] font-bold leading-none text-marigold-ink">{title}</p>
      {children}
    </div>
  );
}
