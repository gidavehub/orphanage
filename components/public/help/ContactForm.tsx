"use client";

import Link from "next/link";
import { Suspense, startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field } from "@/components/ui/form/Field";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { IconDisc } from "@/components/ui/IconDisc";
import { IDLE, type FieldErrors, type FormState } from "@/lib/forms/types";
import { CONTACT_CATEGORIES, isContactCategory, isProgrammeSlug } from "@/lib/model/enums";
import { CONTACT_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { CONTACT_FIELD_ORDER, CONTACT_MESSAGE_MAX, CONTACT_PSEUDO, CONTACT_SUBJECT_MAX, validateContact } from "@/lib/schemas/forms/contact";
import type { ContactSuccess } from "@/lib/server/intake/contact";
import { failureMessage, pickErrors, readForm } from "./form-utils";
import { QueryPrefill } from "./QueryPrefill";

type State = FormState<string, ContactSuccess>;

export type ContactFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  programmes: Array<{ slug: string; title: string }>;
  contact: { phone: string; email: string };
  responseTime: string;
  /** The safeguarding redirect sentence (pages.contact → concernRedirect). */
  concernText: string;
};

const PREFILL_KEYS = ["category", "programme", "subject"] as const;

/** The category select: the eight stored categories plus the two choices that lead elsewhere (D104). */
const CATEGORY_OPTIONS = [
  ...CONTACT_CATEGORIES.map((c) => ({ value: c, label: CONTACT_CATEGORY_LABEL[c] })),
  { value: CONTACT_PSEUDO.privacy, label: "Privacy or data request" },
  { value: CONTACT_PSEUDO.concern, label: "I want to report a concern about a child" },
];

/**
 * The contact form (public-pages §3.8, PLAN D81, D104): one step, validated on blur and on send.
 * "Report a concern" replaces the form with the safeguarding redirect so it can never be sent here;
 * "Privacy or data request" points to /privacy/request. `?category=`, `?programme=` and `?subject=`
 * prefill it (read client-side in Suspense, so the page stays static).
 */
export function ContactForm({ action, programmes, contact, responseTime, concernText }: ContactFormProps) {
  const [state, dispatch, pending] = useActionState<State, FormData>(action, IDLE as State);
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const touched = useRef(new Set<string>());
  const lastState = useRef<State>(state);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusKey, setFocusKey] = useState(0);
  const [formMessage, setFormMessage] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState("");
  const [programme, setProgramme] = useState("");
  const [subject, setSubject] = useState<{ key: number; value: string }>({ key: 0, value: "" });

  const success = state.status === "success" ? state : null;
  const redirect = category === CONTACT_PSEUDO.concern ? "concern" : category === CONTACT_PSEUDO.privacy ? "privacy" : null;

  // A server answer: errors are taken into state while rendering; the effect only scrolls.
  const [seenState, setSeenState] = useState<State>(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error") {
      setErrors((state.fieldErrors ?? {}) as FieldErrors);
      setFormMessage(failureMessage(state, { phone: contact.phone, email: contact.email, noun: "message" }));
      setFocusKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.status === "success") {
      cardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [state]);

  const onPrefill = useCallback(
    (v: Record<string, string>) => {
      const c = v.category?.trim().toLowerCase().replace(/-/g, "_");
      if (c && (isContactCategory(c) || c === CONTACT_PSEUDO.privacy || c === CONTACT_PSEUDO.concern)) setCategory((cur) => cur || c);
      const p = v.programme?.trim().toLowerCase();
      if (p && isProgrammeSlug(p) && programmes.some((x) => x.slug === p)) {
        setProgramme((cur) => cur || p);
        if (!c) setCategory((cur) => cur || "programme_info");
      }
      const s = v.subject?.trim();
      if (s) setSubject((cur) => (cur.value ? cur : { key: cur.key + 1, value: s.slice(0, CONTACT_SUBJECT_MAX) }));
    },
    [programmes],
  );

  const recheck = useCallback(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => prev[k] && k !== "_form");
      if (!keys.length) return prev;
      const errs = validateContact(readForm(formRef.current));
      const next: FieldErrors = { ...prev };
      for (const k of keys) {
        if (errs[k]) next[k] = errs[k];
        else delete next[k];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    recheck();
  }, [category, programme, recheck]);

  const onBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const name = (e.target as EventTarget & { name?: string }).name;
    if (!name || !touched.current.has(name)) return;
    const errs = validateContact(readForm(formRef.current));
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
    recheck();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || redirect) return;
    const errs = validateContact(readForm(formRef.current));
    setErrors(errs);
    setFormMessage(undefined);
    if (Object.keys(errs).length) {
      setFocusKey((k) => k + 1);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setFormMessage("You seem to be offline. Your message is safe on this page; reconnect and press Send again.");
      setFocusKey((k) => k + 1);
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };


  if (success) {
    const name = success.data?.firstName;
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          title={name ? `Thank You, ${name}` : "Thank You"}
          reference={success.reference}
          message={
            <>
              <p>Your message has been sent.</p>
              <p className="mt-2">We usually reply within {responseTime}. We&apos;ve emailed you a copy of your reference.</p>
            </>
          }
          actions={
            <>
              <Button href={routes.home} variant="forest" icon="none">
                Back to Home
              </Button>
              <Button href={routes.faq()} variant="outline">
                Read Common Questions
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const err = (name: string) => errors[name];

  return (
    <div ref={cardRef} className="scroll-mt-28">
      <Suspense fallback={null}>
        <QueryPrefill keys={PREFILL_KEYS} onValues={onPrefill} />
      </Suspense>
      <form ref={formRef} noValidate onSubmit={onSubmit} onBlur={onBlur} onChange={onChange} aria-labelledby="contact-form-title" className="relative">
        <h2 id="contact-form-title" className="text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
          Send Us a Message
          <span aria-hidden className="mt-3 block h-[2px] w-12 bg-marigold" />
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-body">Every question is required unless it says optional.</p>
        <Honeypot />
        <Turnstile action="contact" />
        <fieldset disabled={pending} className="m-0 mt-7 min-w-0 border-0 p-0">
          <ErrorSummary errors={pickErrors(errors, CONTACT_FIELD_ORDER)} message={formMessage} focusKey={focusKey} className="mb-8" />
          <div className="grid gap-6">
            <Field name="category" label="What is your message about?" error={err("category")}>
              <Select placeholder="Choose a topic" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORY_OPTIONS} />
            </Field>

            {redirect === "concern" ? (
              <div role="status" className="animate-[hero-rise_0.6s_var(--ease-out-expo)_both] rounded-card bg-deep p-6 text-white focus-marigold motion-reduce:animate-none sm:p-7">
                <div className="flex items-start gap-4">
                  <IconDisc icon={ShieldAlert} size={52} tone="deep" halo="none" className="border border-white/15" />
                  <div className="min-w-0">
                    <p className="text-[18px] font-extrabold leading-snug">Please use our confidential concern form</p>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/85">{concernText}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button href={routes.concern()} variant="marigold-ink" icon="arrow-right">
                    Report a Concern
                  </Button>
                  <Button variant="outline-light" icon="none" onClick={() => setCategory("")}>
                    Choose another topic
                  </Button>
                </div>
              </div>
            ) : redirect === "privacy" ? (
              <div role="status" className="animate-[hero-rise_0.6s_var(--ease-out-expo)_both] rounded-card bg-mint p-6 motion-reduce:animate-none sm:p-7">
                <div className="flex items-start gap-4">
                  <IconDisc icon={UserRoundCog} size={52} halo="none" />
                  <div className="min-w-0">
                    <p className="text-[18px] font-extrabold leading-snug text-ink">Privacy and data requests have their own form</p>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">
                      Ask us to show you, correct or delete what we hold about you, or to stop contacting you. We confirm your email first, then reply within 30 days.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button href={routes.privacyRequest()} variant="forest" icon="arrow-right">
                    Make a Privacy Request
                  </Button>
                  <Button variant="outline" icon="none" onClick={() => setCategory("")}>
                    Choose another topic
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {category === "programme_info" ? (
                  <Field name="programme" label="Which programme?" error={err("programme")}>
                    <Select placeholder="Choose a programme" value={programme} onChange={(e) => setProgramme(e.target.value)} options={programmes.map((p) => ({ value: p.slug, label: p.title }))} />
                  </Field>
                ) : null}
                <Field name="fullName" label="Full name" error={err("fullName")}>
                  <Input autoComplete="name" maxLength={120} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field name="email" label="Email" error={err("email")}>
                    <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} />
                  </Field>
                  <Field name="phone" label="Phone" optional error={err("phone")}>
                    <PhoneInput maxLength={30} />
                  </Field>
                </div>
                <Field name="country" label="Country" error={err("country")}>
                  <CountrySelect />
                </Field>
                <Field name="subject" label="Subject" error={err("subject")}>
                  <Input key={subject.key} defaultValue={subject.value} autoComplete="off" maxLength={CONTACT_SUBJECT_MAX} />
                </Field>
                <Field name="message" label="Message" error={err("message")} counter={{ max: CONTACT_MESSAGE_MAX }}>
                  <Textarea rows={7} maxLength={CONTACT_MESSAGE_MAX + 200} />
                </Field>
                <div className="rounded-control bg-paper p-5">
                  <Checkbox
                    name="consent"
                    label={
                      <>
                        I agree to Haven storing my details to respond to this enquiry. <Link href={routes.policy("privacy")}>Privacy Policy</Link>
                      </>
                    }
                    error={err("consent")}
                  />
                </div>
                <div className="flex flex-col-reverse gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[14px] text-body">We usually reply within {responseTime}.</p>
                  <Button type="submit" variant="forest" icon="send" loading={pending} className="max-sm:w-full">
                    {pending ? "Sending…" : "Send Message"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
