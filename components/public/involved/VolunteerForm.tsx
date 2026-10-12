"use client";

import Link from "next/link";
import { Suspense, startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
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
import { Select } from "@/components/ui/form/Select";
import { Stepper } from "@/components/ui/form/Stepper";
import { Textarea } from "@/components/ui/form/Textarea";
import { useStepper } from "@/components/ui/form/useStepper";
import { ChoicePills } from "@/components/public/help/ChoicePills";
import { failureMessage, firstStepWithError, pickErrors, readForm, type RawValues } from "@/components/public/help/form-utils";
import { QueryPrefill } from "@/components/public/help/QueryPrefill";
import { StepNav } from "@/components/public/help/StepNav";
import { useLeaveGuard } from "@/components/public/help/useLeaveGuard";
import { PRESENCE_FIRST } from "@/lib/countries";
import { IDLE, zodToFieldErrors, type FieldErrors, type FormState } from "@/lib/forms/types";
import { HEARD_FROM, VOLUNTEER_DAYS, VOLUNTEER_HOURS, VOLUNTEER_INTERESTS, VOLUNTEER_MODES, type VolunteerInterest } from "@/lib/model/enums";
import { HEARD_FROM_LABEL, VOLUNTEER_DAY_LABEL, VOLUNTEER_HOURS_LABEL, VOLUNTEER_INTEREST_LABEL, VOLUNTEER_MODE_LABEL } from "@/lib/model/labels";
import {
  VOLUNTEER_LANGUAGE_OPTIONS,
  VOLUNTEER_MOTIVATION_MAX,
  VOLUNTEER_MOTIVATION_MIN,
  VOLUNTEER_SKILLS_MAX,
  VOLUNTEER_STEPS,
  volunteerSchema,
  type VolunteerField,
} from "@/lib/schemas/forms/volunteer";
import { cn } from "@/lib/cn";

type State = FormState<VolunteerField>;

export type VolunteerFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  contact: { phone: string; email: string };
  responseTime: string;
  copy: {
    under18: string;
    under18Cta: { label: string; href: string };
    safeguarding: string;
    successTitle: string;
    next: Array<{ title: string; body?: string }>;
  };
  links: { privacy: string; safeguarding: string; involved: string; home: string; stories: string };
};

const opt = <K extends string>(labels: Record<K, string>, keys: readonly K[]) => keys.map((k) => ({ value: k, label: labels[k] }));

const STEP_TITLES = ["About You", "How You'd Like to Help", "Your Consent"];

function headingId(step: number) {
  return `vol-step-${step}`;
}

/** Validates one step with the shared schema: only that step's fields report errors. */
function validateStep(step: number, raw: RawValues): FieldErrors {
  const parsed = volunteerSchema.safeParse(raw);
  if (parsed.success) return {};
  return pickErrors(zodToFieldErrors(parsed.error), VOLUNTEER_STEPS[step]?.fields ?? []);
}

/**
 * The volunteer application (public-pages §3.17): three steps that validate on their own, URL
 * prefill of interests (`?interest=`), a friendly answer for under-18s, and the HVN-VA success screen.
 */
export function VolunteerForm({ action, contact, responseTime, copy, links }: VolunteerFormProps) {
  const [state, dispatch, pending] = useActionState<State, FormData>(action, IDLE as State);
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusKey, setFocusKey] = useState(0);
  const [formMessage, setFormMessage] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [worked, setWorked] = useState<"yes" | "no" | "">("");
  const [mode, setMode] = useState("");
  const [hours, setHours] = useState("");
  const [motivationLength, setMotivationLength] = useState(0);

  const success = state.status === "success" ? state : null;
  useLeaveGuard(dirty && !success);

  const validate = useCallback((step: number): boolean => {
    const errs = validateStep(step, readForm(formRef.current));
    const fields = VOLUNTEER_STEPS[step]?.fields ?? [];
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

  const stepper = useStepper({ count: VOLUNTEER_STEPS.length, validate, headingId });
  const { step, goTo } = stepper;

  const [seenState, setSeenState] = useState<State>(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error") {
      setErrors((state.fieldErrors ?? {}) as FieldErrors);
      setFormMessage(failureMessage(state, { ...contact, noun: "message" }));
      setFocusKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state.status === "success") {
      cardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    if (state.status !== "error") return;
    const target = firstStepWithError((state.fieldErrors ?? {}) as FieldErrors, VOLUNTEER_STEPS);
    if (target >= 0) void goTo(target);
    // Only a new server answer moves the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onPrefill = useCallback((v: Record<string, string>) => {
    const wanted = (v.interest ?? "")
      .split(",")
      .map((s) => s.trim().replace(/-/g, "_"))
      .filter((s): s is VolunteerInterest => (VOLUNTEER_INTERESTS as readonly string[]).includes(s));
    if (wanted.length) setInterests((cur) => (cur.length ? cur : wanted));
  }, []);

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    if (!dirty) setDirty(true);
    const name = (e.target as EventTarget & { name?: string }).name;
    if (!name || !errors[name]) return;
    const errs = validateStep(step, readForm(formRef.current));
    setErrors((prev) => {
      const next = { ...prev };
      if (errs[name]) next[name] = errs[name];
      else delete next[name];
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!stepper.isLast) {
      void stepper.next();
      return;
    }
    for (let s = 0; s < VOLUNTEER_STEPS.length; s++) {
      if (!validate(s)) {
        if (s !== step) void goTo(s);
        return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setFormMessage("You seem to be offline. Your answers are safe on this page; reconnect and press Send again.");
      setFocusKey((k) => k + 1);
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  if (success) {
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          title={copy.successTitle}
          reference={success.reference}
          message={
            <>
              <p>We&rsquo;ll be in touch within {responseTime}.</p>
              <p className="mt-2">A confirmation with your reference is on its way to your inbox.</p>
            </>
          }
          next={copy.next}
          actions={
            <>
              <Button href={links.stories} variant="forest" icon="arrow">
                Read Volunteer Stories
              </Button>
              <Button href={links.home} variant="outline" icon="none">
                Back to Home
              </Button>
            </>
          }
          className="rounded-card-lg bg-white px-5 py-12 shadow-card md:px-10"
        />
      </div>
    );
  }

  const err = (k: VolunteerField) => errors[k];
  const stepErrors = pickErrors(errors, VOLUNTEER_STEPS[step]?.fields ?? []);

  return (
    <div ref={cardRef} className="scroll-mt-28">
      <Suspense fallback={null}>
        <QueryPrefill keys={["interest"]} onValues={onPrefill} />
      </Suspense>
      <Stepper steps={VOLUNTEER_STEPS.map((s) => ({ id: s.id, label: s.label }))} current={step} onStepClick={(i) => void goTo(i)} />

      <form ref={formRef} noValidate onSubmit={onSubmit} onChange={onChange} aria-describedby={`${uid}-required`} className="relative mt-8">
        <p id={`${uid}-required`} className="sr-only">
          Every question is required unless it says optional.
        </p>
        <Honeypot />
        <Turnstile action="volunteer" />
        <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <ErrorSummary errors={stepErrors} message={formMessage} focusKey={focusKey} className="mb-8" />

          {/* Step 1: about you */}
          <section hidden={step !== 0} aria-labelledby={headingId(0)}>
            <StepHeading step={0} />
            <div className="mt-8 grid gap-7">
              <Field name="fullName" label="Full name" error={err("fullName")}>
                <Input type="text" autoComplete="name" maxLength={100} />
              </Field>
              <div className="grid gap-7 md:grid-cols-2">
                <Field name="email" label="Email address" error={err("email")}>
                  <Input type="email" autoComplete="email" inputMode="email" spellCheck={false} maxLength={254} />
                </Field>
                <Field name="phone" label="Phone or WhatsApp" hint="With country code, like +220 …" error={err("phone")}>
                  <PhoneInput maxLength={24} />
                </Field>
              </div>
              <div className="grid gap-7 md:grid-cols-2">
                <Field name="country" label="Country" error={err("country")}>
                  <CountrySelect priority={PRESENCE_FIRST} defaultValue="" />
                </Field>
                <Field name="locality" label="Town or area" optional error={err("locality")}>
                  <Input type="text" autoComplete="address-level2" maxLength={80} />
                </Field>
              </div>
              <div className="grid gap-4">
                <Checkbox name="isAdult" label="I am 18 or older" error={err("isAdult")} />
                {err("isAdult") ? (
                  <Notice tone="info" compact live action={<Link href={copy.under18Cta.href} className="font-bold text-forest underline underline-offset-4">{copy.under18Cta.label} →</Link>}>
                    {copy.under18}
                  </Notice>
                ) : null}
              </div>
              <Fieldset name="languages" legend="Languages you speak" hint="Choose any (optional)." size="sm" error={err("languages")}>
                <Chips multiple name="languages" tone="coral" label="Languages you speak" options={VOLUNTEER_LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))} onChange={() => setDirty(true)} />
              </Fieldset>
            </div>
          </section>

          {/* Step 2: how you'd like to help */}
          <section hidden={step !== 1} aria-labelledby={headingId(1)}>
            <StepHeading step={1} />
            <div className="mt-8 grid gap-8">
              <Fieldset name="interests" legend="How would you like to help?" hint="Choose all that interest you." size="sm" error={err("interests")}>
                <Chips
                  multiple
                  name="interests"
                  tone="coral"
                  label="How would you like to help?"
                  options={opt(VOLUNTEER_INTEREST_LABEL, VOLUNTEER_INTERESTS)}
                  value={interests}
                  onChange={(v) => {
                    setInterests(v);
                    setDirty(true);
                    if (errors.interests && v.length) setErrors(({ interests: _i, ...rest }) => (void _i, rest));
                  }}
                />
              </Fieldset>
              <Field name="skills" label="Your profession or skills" optional hint="For example: teacher, nurse, accountant, photographer, web developer." counter={{ max: VOLUNTEER_SKILLS_MAX }} error={err("skills")}>
                <Textarea rows={3} maxLength={VOLUNTEER_SKILLS_MAX + 100} />
              </Field>
              <ChoicePills name="mode" legend="Where could you help?" options={opt(VOLUNTEER_MODE_LABEL, VOLUNTEER_MODES)} value={mode as never} onChange={(v) => setMode(v)} error={err("mode")} />
              <Fieldset name="days" legend="When are you usually free?" hint="Choose any (optional)." size="sm" error={err("days")}>
                <Chips multiple name="days" tone="coral" label="When are you usually free?" options={opt(VOLUNTEER_DAY_LABEL, VOLUNTEER_DAYS)} onChange={() => setDirty(true)} />
              </Fieldset>
              <ChoicePills name="hours" legend="Roughly how much time could you give?" options={opt(VOLUNTEER_HOURS_LABEL, VOLUNTEER_HOURS)} value={hours as never} onChange={(v) => setHours(v)} error={err("hours")} stack />
              <ChoicePills
                name="workedWithChildren"
                legend="Have you worked with children before?"
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                value={worked}
                onChange={(v) => setWorked(v as "yes" | "no")}
                error={err("workedWithChildren")}
              />
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo motion-reduce:transition-none",
                  worked === "yes" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
                aria-hidden={worked !== "yes"}
              >
                <div className="overflow-hidden">
                  <Field name="workedWithChildrenNote" label="Tell us briefly about it" optional hint="Where, in what role and for how long." counter={{ max: 500 }} error={err("workedWithChildrenNote")}>
                    <Textarea rows={3} maxLength={600} disabled={worked !== "yes"} />
                  </Field>
                </div>
              </div>
              <Field
                name="motivation"
                label="Why would you like to volunteer with Haven?"
                hint={`${VOLUNTEER_MOTIVATION_MIN} to ${VOLUNTEER_MOTIVATION_MAX.toLocaleString("en")} characters. A few honest sentences are perfect.`}
                counter={{ max: VOLUNTEER_MOTIVATION_MAX }}
                error={err("motivation")}
              >
                <Textarea rows={6} maxLength={VOLUNTEER_MOTIVATION_MAX + 200} onInput={(e) => setMotivationLength(e.currentTarget.value.length)} />
              </Field>
              <p aria-hidden className={cn("-mt-5 text-[13px] font-semibold transition-colors", motivationLength >= VOLUNTEER_MOTIVATION_MIN ? "text-forest-700" : "text-body")}>
                {motivationLength >= VOLUNTEER_MOTIVATION_MIN ? "Thank you. That helps us a lot." : `At least ${VOLUNTEER_MOTIVATION_MIN} characters, please.`}
              </p>
              <Field name="heardFrom" label="How did you hear about us?" optional error={err("heardFrom")}>
                <Select defaultValue="" options={[{ value: "", label: "Choose one" }, ...opt(HEARD_FROM_LABEL, HEARD_FROM)]} />
              </Field>
            </div>
          </section>

          {/* Step 3: consent */}
          <section hidden={step !== 2} aria-labelledby={headingId(2)}>
            <StepHeading step={2} />
            <div className="mt-8 grid gap-6">
              <Notice tone="info" compact>
                {copy.safeguarding}
              </Notice>
              <Checkbox name="consent" label="Haven may contact me about volunteering." error={err("consent")} />
              <Checkbox
                name="privacy"
                label={
                  <>
                    I have read the <Link href={links.privacy}>Privacy Policy</Link> and understand how my information is used.
                  </>
                }
                error={err("privacy")}
              />
              <Checkbox
                name="safeguarding"
                label={
                  <>
                    I understand that volunteers working with children must complete safeguarding checks, and I have read the{" "}
                    <Link href={links.safeguarding}>Safeguarding Policy</Link>.
                  </>
                }
                error={err("safeguarding")}
              />
            </div>
          </section>

          <StepNav
            isFirst={stepper.isFirst}
            isLast={stepper.isLast}
            onBack={stepper.back}
            onNext={() => void stepper.next()}
            submitLabel="Send My Application"
            pendingLabel="Sending…"
            pending={pending}
          />
        </fieldset>
      </form>
    </div>
  );
}

function StepHeading({ step }: { step: number }) {
  return (
    <h2 id={headingId(step)} tabIndex={-1} className="scroll-mt-32 text-[24px] font-extrabold leading-tight text-ink outline-offset-8 focus-forest md:text-[28px]">
      {STEP_TITLES[step]}
      <span aria-hidden className="mt-3 block h-[2px] w-12 bg-marigold" />
    </h2>
  );
}
