"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Chips } from "@/components/ui/form/Chips";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field } from "@/components/ui/form/Field";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Stepper } from "@/components/ui/form/Stepper";
import { Textarea } from "@/components/ui/form/Textarea";
import { useStepper } from "@/components/ui/form/useStepper";
import { renderInline } from "@/lib/content/inline";
import { IDLE, type FieldErrors, type FormState } from "@/lib/forms/types";
import { PRESENCE_FIRST } from "@/lib/countries";
import { AGE_BAND_LABEL, CONCERN_TYPE_LABEL, CONTACT_METHOD_LABEL, RELATIONSHIP_LABEL, YES_NO_UNSURE_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import {
  CONCERN_AGE_BANDS,
  CONCERN_RELATIONSHIPS,
  CONCERN_STEPS,
  CONCERN_TYPE_ORDER,
  NARRATIVE_MAX,
  validateConcernStep,
  type ReporterMode,
} from "@/lib/schemas/forms/concern";
import type { ConcernSuccess } from "@/lib/server/intake/concern";
import { ChoicePills } from "./ChoicePills";
import { EmergencyBlock, type EmergencyContact } from "./EmergencyBlock";
import { failureMessage, first, firstStepWithError, maskEmail, pickErrors, readForm } from "./form-utils";
import { StepNav } from "./StepNav";
import { useLeaveGuard } from "./useLeaveGuard";

type State = FormState<string, ConcernSuccess>;

export type ConcernFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  contact: { phone: string; phoneHref: string; email: string };
  safety: { text: string; contacts: EmergencyContact[] };
  copy: {
    anonymousNote: string;
    /** InlineText: may carry a [Privacy Policy](/policies/privacy) link. */
    consent: string;
    successTitle: string;
    nextSteps: Array<{ title: string; body?: string }>;
    staffOnly: string;
  };
};

const YNU = (["yes", "no", "unsure"] as const).map((v) => ({ value: v, label: YES_NO_UNSURE_LABEL[v] }));
const AGE_OPTIONS = CONCERN_AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABEL[a] }));
// Pills stay short enough for a 360px screen; the long harmful-practices label moves to the hint.
const TYPE_OPTIONS = CONCERN_TYPE_ORDER.map((t) => ({ value: t, label: t === "harmful_practice" ? "Harmful practices" : CONCERN_TYPE_LABEL[t] }));
const METHOD_OPTIONS = (["phone", "whatsapp", "sms", "email"] as const).map((m) => ({ value: m, label: CONTACT_METHOD_LABEL[m] }));
const MODE_OPTIONS = [
  { value: "named" as const, label: "Share my details" },
  { value: "anonymous" as const, label: "Stay anonymous" },
];

const headingId = (step: number) => `concern-step-${step}`;

/**
 * Report a child-protection concern (public-pages §3.7, PLAN D79, D94, D95, D108): three calm steps,
 * an anonymous mode that removes every personal field, the emergency banner re-surfacing when the
 * child is in danger now, no drafts (a leave guard instead) and the same reference screen for all.
 */
export function ConcernForm({ action, contact, safety, copy }: ConcernFormProps) {
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
  const [sentEmail, setSentEmail] = useState("");

  const [age, setAge] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [danger, setDanger] = useState("");
  const [authorities, setAuthorities] = useState("");
  const [mode, setMode] = useState<ReporterMode>("named");
  const [method, setMethod] = useState("");

  const success = state.status === "success" ? state : null;
  useLeaveGuard(dirty && !success);

  const validate = useCallback((step: number): boolean => {
    const raw = readForm(formRef.current);
    const errs = validateConcernStep(step, raw);
    const fields = CONCERN_STEPS[step]?.fields ?? [];
    setErrors((prev) => {
      const next: FieldErrors = { ...prev };
      for (const f of fields) delete next[f];
      return { ...next, ...errs };
    });
    setFormMessage(undefined);
    const ok = Object.keys(errs).length === 0;
    if (!ok) setFocusKey((k) => k + 1);
    return ok;
  }, []);

  const stepper = useStepper({ count: CONCERN_STEPS.length, validate, headingId });
  const { step, goTo } = stepper;

  // A server answer: errors are taken into state while rendering; the effect only navigates/scrolls.
  const [seenState, setSeenState] = useState<State>(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error") {
      const fieldErrors = (state.fieldErrors ?? {}) as FieldErrors;
      setErrors(fieldErrors);
      setFormMessage(failureMessage(state, { phone: contact.phone, email: contact.email, noun: "report" }));
      const target = firstStepWithError(fieldErrors, CONCERN_STEPS);
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
    const target = firstStepWithError((state.fieldErrors ?? {}) as FieldErrors, CONCERN_STEPS);
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

  /** Re-checks fields that show an error, after React has committed the latest choice. */
  const recheck = useCallback(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => prev[k] && k !== "_form");
      if (!keys.length) return prev;
      const errs = validateConcernStep(step, readForm(formRef.current));
      const fields = CONCERN_STEPS[step]?.fields ?? [];
      const next: FieldErrors = { ...prev };
      for (const k of keys) {
        if (!fields.includes(k as never)) continue;
        if (errs[k]) next[k] = errs[k];
        else delete next[k];
      }
      return next;
    });
  }, [step]);

  // Pills and chips write hidden inputs on render: re-check once the new values are in the DOM.
  useEffect(() => {
    recheck();
  }, [age, types, danger, authorities, mode, method, recheck]);

  const onBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const name = (e.target as EventTarget & { name?: string }).name;
    if (!name || !touched.current.has(name)) return;
    const errs = validateConcernStep(step, readForm(formRef.current));
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
    recheck();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!stepper.isLast) {
      void stepper.next();
      return;
    }
    for (let s = 0; s < CONCERN_STEPS.length; s++) {
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
    setSentEmail(mode === "named" ? first(readForm(formRef.current).email) : "");
    startTransition(() => dispatch(fd));
  };

  if (success) {
    const masked = success.data?.emailSent ? maskEmail(sentEmail) : null;
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          tone="forest"
          icon="shield"
          title={copy.successTitle}
          reference={success.reference}
          referenceLabel="Your reference"
          message={
            <>
              <p>Your report has been sent securely to our safeguarding team.</p>
              <p className="mt-2">If you need to tell us more about this report, please quote this reference.</p>
              {masked ? <p className="mt-2">We&apos;ve sent a short confirmation to {masked}. It doesn&apos;t mention your report.</p> : null}
            </>
          }
          next={copy.nextSteps}
          nextTitle="What happens next"
          actions={
            <Button href={routes.home} variant="forest" icon="none">
              Back to Home
            </Button>
          }
        />
        <EmergencyBlock text={safety.text} contacts={safety.contacts} className="mt-10" />
      </div>
    );
  }

  const stepErrors = (s: number) => pickErrors(errors, CONCERN_STEPS[s]?.fields ?? []);
  const err = (name: string) => errors[name];
  const showDanger = danger === "yes" || danger === "unsure";

  return (
    <div ref={cardRef} className="scroll-mt-28">
      <Stepper steps={CONCERN_STEPS.map((s) => ({ id: s.id, label: s.label }))} current={step} onStepClick={(i) => void goTo(i)} />

      <form ref={formRef} noValidate onSubmit={onSubmit} onBlur={onBlur} onChange={onChange} aria-describedby={`${uid}-required`} className="relative mt-8">
        <p id={`${uid}-required`} className="sr-only">
          Every question is required unless it says optional.
        </p>
        <Honeypot />
        <Turnstile action="concern" />
        <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <div ref={summaryRef}>
            <ErrorSummary errors={stepErrors(step)} message={formMessage} focusKey={focusKey} className="mb-8" />
          </div>

          {/* Step 1: the child and the concern */}
          <section hidden={step !== 0} aria-labelledby={headingId(0)}>
            <StepHeading step={0} />
            <div className="mt-7 grid gap-8">
              <ChoicePills name="childAge" legend="The child's approximate age" options={AGE_OPTIONS} value={age as never} onChange={setAge} error={err("childAge")} />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="country" label="Country" error={err("country")}>
                  <CountrySelect priority={PRESENCE_FIRST} />
                </Field>
                <Field name="area" label="Town, area or place" optional hint="Anything that helps us reach the right services." error={err("area")}>
                  <Input autoComplete="off" maxLength={300} />
                </Field>
              </div>
              <p className="-mt-4 flex items-start gap-2 text-[14px] leading-relaxed text-body">
                <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={2.25} />
                Only our safeguarding staff can see where the child is.
              </p>

              <Fieldset
                name="concernTypes"
                legend="What is the concern about?"
                hint="Choose all that apply. Harmful practices include early or forced marriage and FGM/C."
                size="sm"
                error={err("concernTypes")}
              >
                <Chips
                  multiple
                  name="concernTypes"
                  tone="coral"
                  label="What is the concern about"
                  options={TYPE_OPTIONS}
                  value={types}
                  onChange={(v) => {
                    setTypes(v);
                    setDirty(true);
                  }}
                />
              </Fieldset>

              <Field
                name="narrative"
                label="What has happened, or what are you worried about?"
                hint="Tell us in your own words. Include anything that would help us act, such as when it happened and who is involved."
                error={err("narrative")}
                counter={{ max: NARRATIVE_MAX }}
              >
                <Textarea rows={8} maxLength={NARRATIVE_MAX + 200} />
              </Field>

              <div className="grid gap-4">
                <ChoicePills name="inDangerNow" legend="Is the child in danger now?" options={YNU} value={danger as never} onChange={setDanger} error={err("inDangerNow")} urgentValue="yes" />
                {showDanger ? (
                  <EmergencyBlock
                    live
                    text={safety.text}
                    contacts={safety.contacts}
                    action={<p className="text-[14px] text-white/85">Please also finish this report. Our safeguarding team is alerted the moment it arrives.</p>}
                  />
                ) : null}
              </div>

              <div className="grid gap-4">
                <ChoicePills
                  name="authoritiesContacted"
                  legend="Have the police, social services or another authority been told?"
                  options={YNU}
                  value={authorities as never}
                  onChange={setAuthorities}
                  error={err("authoritiesContacted")}
                />
                {authorities === "yes" ? (
                  <Field name="authorityDetails" label="Who did you contact?" optional hint="For example the police station or the social worker's office." error={err("authorityDetails")}>
                    <Input autoComplete="off" maxLength={300} />
                  </Field>
                ) : null}
              </div>
            </div>
          </section>

          {/* Step 2: about you */}
          <section hidden={step !== 1} aria-labelledby={headingId(1)}>
            <StepHeading step={1} />
            <div className="mt-7 grid gap-7">
              <div className="grid gap-3">
                <p id={`${uid}-mode`} className="text-[16px] font-bold text-ink">
                  Would you like to share your details?
                </p>
                <Segmented
                  name="reporterMode"
                  label="Would you like to share your details?"
                  aria-describedby={`${uid}-mode-hint`}
                  options={MODE_OPTIONS}
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    setDirty(true);
                  }}
                  skin="donat"
                  className="max-w-[440px]"
                />
                <p id={`${uid}-mode-hint`} className="text-[14px] leading-relaxed text-body">
                  Sharing your details lets us ask you questions if we need to. You can stay anonymous.
                </p>
              </div>

              {mode === "anonymous" ? (
                <Notice tone="info" icon={EyeOff} title="You are reporting anonymously" live>
                  {copy.anonymousNote}
                </Notice>
              ) : (
                <div className="grid gap-7">
                  <Field name="name" label="Your name" error={err("name")}>
                    <Input autoComplete="name" maxLength={120} />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field name="phone" label="Phone" optional hint="With the country code, like +220." error={err("phone")}>
                      <PhoneInput maxLength={30} />
                    </Field>
                    <Field name="email" label="Email" optional error={err("email")}>
                      <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} />
                    </Field>
                  </div>
                  <p className="-mt-3 text-[14px] leading-relaxed text-body">Please give a phone number, an email, or both.</p>
                  <Field name="relationship" label="How do you know the child?" error={err("relationship")}>
                    <Select placeholder="Choose one" defaultValue="" options={CONCERN_RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))} />
                  </Field>
                  <div className="grid gap-4 rounded-control border border-line bg-cream-2 p-5 sm:p-6">
                    <ChoicePills
                      name="followUpMethod"
                      legend="What is the safest way for us to follow up?"
                      options={METHOD_OPTIONS}
                      value={method as never}
                      onChange={(v) => {
                        setMethod(v);
                        setDirty(true);
                      }}
                      error={err("followUpMethod")}
                    />
                    <Field name="followUpTimes" label="When is it safe to contact you?" hint="For example: weekday mornings only, or send a message first." error={err("followUpTimes")}>
                      <Input autoComplete="off" maxLength={200} />
                    </Field>
                    {method === "email" ? (
                      <Checkbox
                        name="emailConfirmationAllowed"
                        label="Send me a short confirmation email. It won't mention this report."
                        hint="Leave this unticked if someone else can read your email."
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Step 3: consent and send */}
          <section hidden={step !== 2} aria-labelledby={headingId(2)}>
            <StepHeading step={2} />
            <div className="mt-7 grid gap-7">
              <ul className="grid gap-3 rounded-control bg-mint/60 p-5 text-[15px] leading-relaxed text-ink sm:p-6">
                <li className="flex items-start gap-3">
                  <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={2.25} />
                  {copy.staffOnly}
                </li>
                <li className="flex items-start gap-3">
                  <LockKeyhole aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={2.25} />
                  Your report is encrypted when it is stored, and every time it is opened is recorded.
                </li>
                <li className="flex items-start gap-3">
                  <EyeOff aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={2.25} />
                  {mode === "anonymous"
                    ? "You are reporting anonymously: we will not know who sent it."
                    : "We only share what you tell us with child-protection services or the authorities when it is needed to keep a child safe."}
                </li>
              </ul>
              <div className="rounded-control bg-paper p-5 sm:p-6">
                <Checkbox name="consent" label={renderInline(copy.consent)} error={err("consent")} />
              </div>
            </div>
          </section>

          <StepNav
            isFirst={stepper.isFirst}
            isLast={stepper.isLast}
            onBack={stepper.back}
            onNext={() => void stepper.next()}
            submitLabel="Send Report Securely"
            pendingLabel="Sending securely…"
            pending={pending}
            aboveQuickExit
          />
        </fieldset>
      </form>
    </div>
  );
}

function StepHeading({ step }: { step: number }) {
  const s = CONCERN_STEPS[step];
  return (
    <h2 id={headingId(step)} tabIndex={-1} className="scroll-mt-32 text-[24px] font-extrabold leading-tight text-ink outline-offset-8 focus-forest md:text-[28px]">
      {s?.title}
      <span aria-hidden className="mt-3 block h-[2px] w-12 bg-marigold" />
    </h2>
  );
}
