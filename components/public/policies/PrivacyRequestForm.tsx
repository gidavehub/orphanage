"use client";

import { useActionState, useRef, useState } from "react";
import { BellOff, FileSearch, PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field } from "@/components/ui/form/Field";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { RadioCards, type RadioCardOption } from "@/components/ui/form/RadioCards";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { Textarea } from "@/components/ui/form/Textarea";
import type { TimelineItem } from "@/components/ui/Timeline";
import { IDLE, type FieldErrors, type FormState } from "@/lib/forms/types";
import type { DataRequestType } from "@/lib/model/domain/system";
import {
  DATA_REQUEST_DETAILS_MAX,
  DATA_REQUEST_FIELD_ORDER,
  DATA_REQUEST_TYPE_OPTIONS,
  DATA_REQUEST_TYPES,
  dataRequestSchema,
  type DataRequestField,
} from "@/lib/schemas/forms/dataRequest";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type PrivacyRequestFormProps = {
  action: Action;
  /** "Please check your email…" (pages.privacyRequest → checkEmail). */
  checkEmail: string;
  /** What happens after sending (pages.privacyRequest → steps). */
  steps: Array<{ title: string; text?: string }>;
  /** settings.contact.teamEmails.privacy. */
  privacyEmail: string;
  /** The privacy policy page. */
  policyHref: string;
  className?: string;
};

const ICONS: Record<DataRequestType, React.ReactElement> = {
  access: <FileSearch aria-hidden className="size-6" strokeWidth={2.25} />,
  correction: <PencilLine aria-hidden className="size-6" strokeWidth={2.25} />,
  deletion: <Trash2 aria-hidden className="size-6" strokeWidth={2.25} />,
  stop_contact: <BellOff aria-hidden className="size-6" strokeWidth={2.25} />,
};

const OPTIONS: RadioCardOption[] = DATA_REQUEST_TYPES.map((t) => ({
  value: t,
  label: DATA_REQUEST_TYPE_OPTIONS[t].label,
  description: DATA_REQUEST_TYPE_OPTIONS[t].description,
  icon: ICONS[t],
}));

/** What to put in "Tell us more", depending on the request. */
const DETAILS_HINT: Record<DataRequestType | "none", string> = {
  none: "Tell us what you'd like us to do, and anything that helps us find your records, such as when you contacted us or which form you used.",
  access: "Tell us which information you'd like to see, and anything that helps us find it, such as when you contacted us or which form you used.",
  correction: "Tell us what is wrong and what it should say instead. Please don't include medical or other sensitive details here.",
  deletion: "Tell us what you'd like us to delete. Some records, such as gift receipts, must be kept for a time by law, and we'll explain if so.",
  stop_contact: "Tell us how we've been contacting you (email, phone or post), so we can make sure it stops everywhere.",
};

const SHAPE = dataRequestSchema.shape;

/** The first error message for one field, from the shared schema (the server checks again). */
function checkField(name: DataRequestField, value: unknown): string | undefined {
  const r = SHAPE[name].safeParse(value);
  return r.success ? undefined : r.error.issues[0]?.message;
}

function valueOf(form: HTMLFormElement, name: DataRequestField): unknown {
  const fd = new FormData(form);
  const v = fd.get(name);
  if (name === "confirm") return v === "on" ? "on" : undefined;
  return typeof v === "string" ? v : undefined;
}

/**
 * The /privacy/request form (PLAN D104): what the person wants, who they are, any references, and a
 * declaration. Fields validate on blur and on submit with the same schema the action uses; the error
 * summary takes focus and links to each field. On success the form is replaced by the reference and
 * "check your email", because nothing happens until the address is confirmed.
 */
export function PrivacyRequestForm({ action, checkEmail, steps, privacyEmail, policyHref, className }: PrivacyRequestFormProps) {
  const [state, formAction] = useActionState(action, IDLE);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [type, setType] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  // The server's answer wins for the submit it belongs to; edits after it clear field by field.
  const [seen, setSeen] = useState<FormState>(state);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  if (seen !== state) {
    setSeen(state);
    setServerErrors(state.status === "error" ? (state.fieldErrors ?? {}) : {});
    if (state.status === "error" && state.values?.type) setType(state.values.type);
  }
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const errorOf = (name: DataRequestField) => errors[name];

  const setFieldError = (name: DataRequestField, message: string | undefined) => {
    setClientErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
    if (!message) {
      setServerErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const onBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const target = e.target as unknown as { name?: unknown };
    const name = (typeof target.name === "string" ? target.name : "") as DataRequestField;
    if (!form.current || !(DATA_REQUEST_FIELD_ORDER as string[]).includes(name) || name === "type" || name === "confirm") return;
    const value = valueOf(form.current, name);
    // Don't shout at an empty required field the person has only tabbed through.
    if ((value === undefined || value === "") && !errors[name]) return;
    setFieldError(name, checkField(name, value));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const el = e.currentTarget;
    const next: FieldErrors = {};
    for (const name of DATA_REQUEST_FIELD_ORDER) {
      const message = checkField(name, valueOf(el, name));
      if (message) next[name] = message;
    }
    setAttempt((n) => n + 1);
    if (Object.keys(next).length) {
      e.preventDefault();
      setClientErrors(next);
      return;
    }
    setClientErrors({});
  };

  if (state.status === "success") {
    const next: TimelineItem[] = steps.map((s, i) => ({ id: `s${i}`, title: s.title, body: s.text }));
    return (
      <div className={className}>
        <FormSuccess
          title="Please check your email"
          reference={state.reference}
          message={
            <>
              <p>{checkEmail}</p>
              <p className="mt-3 text-[15px]">
                No email after 15 minutes? Check your spam folder, or write to{" "}
                <a href={`mailto:${privacyEmail}`} className="font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
                  {privacyEmail}
                </a>{" "}
                with your reference.
              </p>
            </>
          }
          next={next}
          actions={
            <Button href={policyHref} variant="outline" icon="none">
              Read our Privacy Policy
            </Button>
          }
        />
      </div>
    );
  }

  const ordered: FieldErrors = {};
  for (const name of DATA_REQUEST_FIELD_ORDER) if (errors[name]) ordered[name] = errors[name];
  const formMessage = state.status === "error" && state.code !== "validation" ? state.message : undefined;
  const hasErrors = Object.keys(ordered).length > 0 || !!formMessage;
  const detailsHint = DETAILS_HINT[(type || "none") as DataRequestType | "none"] ?? DETAILS_HINT.none;

  return (
    <form ref={form} action={formAction} onSubmit={onSubmit} onBlur={onBlur} noValidate className={className} aria-describedby="privacy-form-note">
      {hasErrors ? <ErrorSummary errors={ordered} message={formMessage} focusKey={attempt} className="mb-10" /> : null}

      <RadioCards
        name="type"
        legend="What would you like us to do?"
        hint="Choose one. If you need more than one thing, choose the main one and tell us the rest below."
        options={OPTIONS}
        columns={2}
        value={type}
        onChange={(v) => {
          setType(v);
          setFieldError("type", undefined);
        }}
        error={errorOf("type")}
      />

      <Fieldset legend="About you" hint="We use these details only to find your records and to answer this request." className="mt-12">
        <Field name="fullName" label="Full name" state={state} error={errorOf("fullName")}>
          <Input autoComplete="name" maxLength={120} />
        </Field>
        <Field
          name="email"
          label="Email address"
          hint="We'll send a link here to confirm the request is yours. Use the address you gave us before, if you can."
          state={state}
          error={errorOf("email")}
        >
          <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} />
        </Field>
        <Field name="phone" label="Phone number" optional state={state} error={errorOf("phone")}>
          <PhoneInput maxLength={24} />
        </Field>
      </Fieldset>

      <Fieldset legend="Your request" className="mt-12">
        <Field
          name="knownReferences"
          label="Any Haven reference numbers"
          optional
          hint="They help us find your records quickly, for example HVN-SR-2026-0012. Separate several with commas."
          state={state}
          error={errorOf("knownReferences")}
        >
          <Input autoComplete="off" spellCheck={false} maxLength={400} />
        </Field>
        <Field name="details" label="Tell us more" hint={detailsHint} counter={{ max: DATA_REQUEST_DETAILS_MAX }} state={state} error={errorOf("details")}>
          <Textarea rows={6} maxLength={DATA_REQUEST_DETAILS_MAX + 200} />
        </Field>
        <Checkbox
          name="confirm"
          checked={confirmed}
          onChange={(e) => {
            setConfirmed(e.currentTarget.checked);
            if (e.currentTarget.checked) setFieldError("confirm", undefined);
          }}
          label="This request is about my own information, or I am allowed to act for the person it is about."
          hint="If you are asking for someone else, tell us how you are connected to them in the box above."
          error={errorOf("confirm")}
        />
      </Fieldset>

      <Honeypot />

      <Turnstile action="data_request" />

      <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <SubmitButton icon="send" pendingLabel="Sending securely…" size="lg">
          Send my request
        </SubmitButton>
        <p id="privacy-form-note" className="max-w-[360px] text-[14px] leading-relaxed text-body">
          Nothing changes until you confirm your email. We reply within 30 days.
        </p>
      </div>
    </form>
  );
}
