"use client";

import Link from "next/link";
import { Suspense, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Building2, FlaskConical, HandCoins, Handshake, Lightbulb, Megaphone, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field, fieldValue } from "@/components/ui/form/Field";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { RadioCards, type RadioCardOption } from "@/components/ui/form/RadioCards";
import { Select } from "@/components/ui/form/Select";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { Textarea } from "@/components/ui/form/Textarea";
import { failureMessage, readForm } from "@/components/public/help/form-utils";
import { QueryPrefill } from "@/components/public/help/QueryPrefill";
import { PRESENCE_FIRST } from "@/lib/countries";
import { IDLE, zodToFieldErrors, type FieldErrors, type FormState } from "@/lib/forms/types";
import { HEARD_FROM, PARTNER_KINDS, PARTNERSHIP_TYPES, type PartnerKind, type PartnershipType } from "@/lib/model/enums";
import { HEARD_FROM_LABEL, PARTNER_KIND_LABEL, PARTNERSHIP_TYPE_LABEL } from "@/lib/model/labels";
import {
  PARTNER_MESSAGE_MAX,
  PARTNER_MESSAGE_MIN,
  PARTNERSHIP_FIELD_ORDER,
  PARTNERSHIP_TYPE_HELP,
  partnershipSchema,
  type PartnershipField,
} from "@/lib/schemas/forms/partnership";

type State = FormState<PartnershipField>;

export type PartnerFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  programmes: Array<{ id: string; slug: string; title: string }>;
  contact: { phone: string; email: string };
  responseTime: string;
  successTitle: string;
  successMessage: string;
  links: { privacy: string; home: string; projects: string };
};

const TYPE_ICON: Record<PartnershipType, RadioCardOption["icon"]> = {
  programme: Handshake,
  corporate_sponsorship: Building2,
  technical_assistance: Wrench,
  institutional_referral: Sparkles,
  research_collaboration: FlaskConical,
  donation_partnership: HandCoins,
  awareness_campaign: Megaphone,
  other: Lightbulb,
};

const TYPE_OPTIONS: RadioCardOption[] = PARTNERSHIP_TYPES.map((t) => ({
  value: t,
  label: PARTNERSHIP_TYPE_LABEL[t],
  description: PARTNERSHIP_TYPE_HELP[t],
  icon: TYPE_ICON[t],
}));

const opt = <K extends string>(labels: Record<K, string>, keys: readonly K[]) => keys.map((k) => ({ value: k, label: labels[k] }));

function ordered(errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const k of PARTNERSHIP_FIELD_ORDER) if (errors[k]) out[k] = errors[k];
  return out;
}

const isType = (v: string): v is PartnershipType => (PARTNERSHIP_TYPES as readonly string[]).includes(v);
const isKind = (v: string): v is PartnerKind => (PARTNER_KINDS as readonly string[]).includes(v);

/**
 * The partnership enquiry (public-pages §3.18). One calm page of questions; `?type=` (a partnership
 * type, or an organisation kind such as an orphanage) and `?programme=` preselect answers.
 */
export function PartnerForm({ action, programmes, contact, responseTime, successTitle, successMessage, links }: PartnerFormProps) {
  const [state, formAction] = useActionState<State, FormData>(action, IDLE as State);
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<string>(fieldValue(state, "partnershipType") ?? "");
  const [kind, setKind] = useState<string>(fieldValue(state, "orgKind") ?? "");
  const [programme, setProgramme] = useState<string>(fieldValue(state, "programme") ?? "");
  const [length, setLength] = useState(0);

  const onPrefill = useCallback(
    (v: Record<string, string>) => {
      const t = (v.type ?? "").replace(/-/g, "_");
      if (isType(t)) setType((cur) => cur || t);
      else if (isKind(t)) {
        setKind((cur) => cur || t);
        if (t === "orphanage_childrens_home" || t === "ngo") setType((cur) => cur || "institutional_referral");
      }
      const p = programmes.find((x) => x.slug === v.programme || x.id === v.programme);
      if (p) setProgramme((cur) => cur || p.id);
    },
    [programmes],
  );

  useEffect(() => {
    if (state.status === "success") cardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          title={successTitle}
          reference={state.reference}
          message={
            <>
              <p>{successMessage}</p>
              <p className="mt-2">We&rsquo;ll reply within {responseTime}. A confirmation with your reference is on its way to your inbox.</p>
            </>
          }
          actions={
            <>
              <Button href={links.projects} variant="forest" icon="arrow">
                See Our Projects
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

  const serverErrors = state.status === "error" ? ((state.fieldErrors ?? {}) as FieldErrors) : {};
  const errors = ordered(clientErrors ?? serverErrors);
  const err = (k: PartnershipField) => errors[k];
  const live = clientErrors ? undefined : state;
  const message = state.status === "error" && !clientErrors ? failureMessage(state, { ...contact, noun: "message" }) : undefined;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const parsed = partnershipSchema.safeParse(readForm(e.currentTarget));
    setAttempt((n) => n + 1);
    if (!parsed.success) {
      e.preventDefault();
      setClientErrors(zodToFieldErrors(parsed.error));
      return;
    }
    setClientErrors(null);
  };

  return (
    <div ref={cardRef} className="scroll-mt-28">
      <Suspense fallback={null}>
        <QueryPrefill keys={["type", "programme"]} onValues={onPrefill} />
      </Suspense>
      <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-12" aria-describedby="partner-required">
        <p id="partner-required" className="text-[15px] leading-relaxed text-body">
          Every question is needed unless it says &ldquo;optional&rdquo;.
        </p>

        <ErrorSummary errors={Object.keys(errors).length ? errors : undefined} message={message} state={clientErrors ? undefined : state} focusKey={attempt} />

        <Fieldset legend="Your organisation">
          <div className="grid gap-7">
            <Field name="orgName" label="Organisation name" error={err("orgName")} state={live}>
              <Input type="text" autoComplete="organization" maxLength={120} />
            </Field>
            <div className="grid gap-7 md:grid-cols-2">
              <Field name="orgKind" label="Type of organisation" error={err("orgKind")}>
                <Select value={kind} onChange={(e) => setKind(e.currentTarget.value)} options={[{ value: "", label: "Choose one" }, ...opt(PARTNER_KIND_LABEL, PARTNER_KINDS)]} />
              </Field>
              <Field name="country" label="Country" error={err("country")} state={live}>
                <CountrySelect priority={PRESENCE_FIRST} defaultValue={fieldValue(state, "country") ?? ""} />
              </Field>
            </div>
            <Field name="website" label="Website" optional hint="For example: example.org" error={err("website")} state={live}>
              <Input type="text" inputMode="url" autoComplete="url" spellCheck={false} maxLength={200} />
            </Field>
          </div>
        </Fieldset>

        <Fieldset legend="Who we should talk to">
          <div className="grid gap-7 md:grid-cols-2">
            <Field name="contactName" label="Contact person" error={err("contactName")} state={live}>
              <Input type="text" autoComplete="name" maxLength={100} />
            </Field>
            <Field name="role" label="Role or job title" optional error={err("role")} state={live}>
              <Input type="text" autoComplete="organization-title" maxLength={80} />
            </Field>
            <Field name="email" label="Email address" error={err("email")} state={live}>
              <Input type="email" autoComplete="email" inputMode="email" spellCheck={false} maxLength={254} />
            </Field>
            <Field name="phone" label="Phone" optional hint="With country code." error={err("phone")} state={live}>
              <PhoneInput maxLength={24} />
            </Field>
          </div>
        </Fieldset>

        <Fieldset legend="Your idea">
          <div className="grid gap-8">
            <RadioCards name="partnershipType" legend="How would you like to partner?" options={TYPE_OPTIONS} columns={2} value={type} onChange={setType} error={err("partnershipType")} />
            <Field name="programme" label="Programme of interest" optional error={err("programme")}>
              <Select value={programme} onChange={(e) => setProgramme(e.currentTarget.value)} options={[{ value: "", label: "Not sure / any programme" }, ...programmes.map((p) => ({ value: p.id, label: p.title }))]} />
            </Field>
            <Field
              name="message"
              label="Tell us about your proposal"
              hint={`${PARTNER_MESSAGE_MIN} to ${PARTNER_MESSAGE_MAX.toLocaleString("en")} characters: what you have in mind, who it would help and when.`}
              counter={{ max: PARTNER_MESSAGE_MAX }}
              error={err("message")}
              state={live}
            >
              <Textarea rows={7} maxLength={PARTNER_MESSAGE_MAX + 200} onInput={(e) => setLength(e.currentTarget.value.length)} />
            </Field>
            <p aria-hidden className="-mt-6 text-[13px] font-semibold text-body">
              {length >= PARTNER_MESSAGE_MIN ? "Thank you. That gives us a good start." : `At least ${PARTNER_MESSAGE_MIN} characters, please.`}
            </p>
            <Field name="heardFrom" label="How did you hear about us?" optional error={err("heardFrom")}>
              <Select defaultValue={fieldValue(state, "heardFrom") ?? ""} options={[{ value: "", label: "Choose one" }, ...opt(HEARD_FROM_LABEL, HEARD_FROM)]} />
            </Field>
          </div>
        </Fieldset>

        <Checkbox
          name="consent"
          label={
            <>
              Haven may contact me about this enquiry. I have read the <Link href={links.privacy}>Privacy Policy</Link>.
            </>
          }
          error={err("consent")}
        />

        <Honeypot />

        <Turnstile action="partner" />

        <div className="flex flex-col items-start gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[420px] text-[14px] leading-relaxed text-body">Haven verifies every partner organisation before any agreement.</p>
          <SubmitButton pendingLabel="Sending…" icon="send" size="lg" className="w-full sm:w-auto">
            Send Enquiry
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
