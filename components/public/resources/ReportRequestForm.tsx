"use client";

import Link from "next/link";
import { Suspense, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Download, Lock, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field, fieldValue } from "@/components/ui/form/Field";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectGroup } from "@/components/ui/form/Select";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { Textarea } from "@/components/ui/form/Textarea";
import { failureMessage, readForm } from "@/components/public/help/form-utils";
import { QueryPrefill } from "@/components/public/help/QueryPrefill";
import { PRESENCE_FIRST } from "@/lib/countries";
import { IDLE, zodToFieldErrors, type FieldErrors, type FormState } from "@/lib/forms/types";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "@/lib/model/enums";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import {
  REPORT_OTHER,
  REPORT_REASON_MAX,
  REPORT_REASON_MIN,
  REPORT_REQUEST_FIELD_ORDER,
  reportRequestSchema,
  type ReportRequestField,
} from "@/lib/schemas/forms/reportRequest";

type State = FormState<ReportRequestField>;

export type ReportOption = { slug: string; title: string; category: ResourceCategory; access: "public" | "controlled"; downloadHref: string | null };

export type ReportRequestFormProps = {
  action: (prev: State, fd: FormData) => Promise<State>;
  reports: ReportOption[];
  /** The resource page's inline form: the report is fixed and the picker is hidden. */
  locked?: ReportOption;
  contact: { phone: string; email: string };
  responseTime: string;
  freeDownloadText: string;
  links: { privacy: string; resources: string };
};

function ordered(errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const k of REPORT_REQUEST_FIELD_ORDER) if (errors[k]) out[k] = errors[k];
  return out;
}

/**
 * The report request (public-pages §3.10–3.11, D59): a picker over every report (those shared on
 * request first, grouped by topic, then the free ones, then "Other / not listed"), `?report=`
 * preselects, and choosing a free report swaps the form for its download button.
 */
export function ReportRequestForm({ action, reports, locked, contact, responseTime, freeDownloadText, links }: ReportRequestFormProps) {
  const [state, formAction] = useActionState<State, FormData>(action, IDLE as State);
  const cardRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<string>(locked?.slug ?? fieldValue(state, "report") ?? "");
  const [email, setEmail] = useState("");

  const onPrefill = useCallback(
    (v: Record<string, string>) => {
      if (locked) return;
      const want = v.report?.trim().toLowerCase();
      if (want && (want === REPORT_OTHER || reports.some((r) => r.slug === want))) setReport((cur) => cur || want);
    },
    [locked, reports],
  );

  useEffect(() => {
    if (state.status === "success") cardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div ref={cardRef} className="scroll-mt-28">
        <FormSuccess
          title="Request Received"
          reference={state.reference}
          message={
            <p>
              We&rsquo;ll email {email || "you"} once it has been reviewed (usually within {responseTime}).
            </p>
          }
          next={[
            { title: "Review", body: "Our team reads your reason and checks the report can be shared." },
            { title: "Approval", body: "A report manager approves the request." },
            { title: "Emailed to you", body: "You receive a secure download link that works for 7 days." },
          ]}
          actions={
            <Button href={links.resources} variant="forest" icon="arrow">
              Browse More Resources
            </Button>
          }
          className="rounded-card-lg bg-white px-5 py-12 shadow-card md:px-10"
        />
      </div>
    );
  }

  const chosen = locked ?? reports.find((r) => r.slug === report);
  const isFree = !!chosen && chosen.access === "public" && !!chosen.downloadHref;
  const serverErrors = state.status === "error" ? ((state.fieldErrors ?? {}) as FieldErrors) : {};
  const errors = ordered(clientErrors ?? serverErrors);
  const err = (k: ReportRequestField) => errors[k];
  const live = clientErrors ? undefined : state;
  const message = state.status === "error" && !clientErrors ? failureMessage(state, { ...contact, noun: "request" }) : undefined;

  const controlled = reports.filter((r) => r.access === "controlled");
  const free = reports.filter((r) => r.access === "public");
  const groups: SelectGroup[] = [
    ...RESOURCE_CATEGORIES.flatMap((c) => {
      const items = controlled.filter((r) => r.category === c);
      return items.length ? [{ label: `On request · ${RESOURCE_CATEGORY_LABEL[c]}`, options: items.map((r) => ({ value: r.slug, label: r.title })) }] : [];
    }),
    ...(free.length ? [{ label: "Free to download", options: free.map((r) => ({ value: r.slug, label: r.title })) }] : []),
    { label: "Something else", options: [{ value: REPORT_OTHER, label: "Other / not listed" }] },
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const raw = readForm(e.currentTarget);
    const parsed = reportRequestSchema.safeParse(raw);
    setAttempt((n) => n + 1);
    if (!parsed.success) {
      e.preventDefault();
      setClientErrors(zodToFieldErrors(parsed.error));
      return;
    }
    setEmail(parsed.data.email);
    setClientErrors(null);
  };

  return (
    <div ref={cardRef} className="scroll-mt-28">
      {!locked ? (
        <Suspense fallback={null}>
          <QueryPrefill keys={["report"]} onValues={onPrefill} />
        </Suspense>
      ) : null}
      <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-8" aria-describedby="rr-required">
        <p id="rr-required" className="text-[15px] leading-relaxed text-body">
          Every question is needed unless it says &ldquo;optional&rdquo;.
        </p>
        <ErrorSummary errors={Object.keys(errors).length ? errors : undefined} message={message} state={clientErrors ? undefined : state} focusKey={attempt} />

        {locked ? (
          <div className="flex items-start gap-3 rounded-control bg-cream px-5 py-4">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={2.25} />
            <p className="text-[15px] leading-relaxed text-ink">
              <span className="font-bold">Requesting:</span> {locked.title}
            </p>
            <input type="hidden" name="report" value={locked.slug} />
          </div>
        ) : (
          <Field name="report" label="Which report would you like?" error={err("report")}>
            <Select value={report} onChange={(e) => setReport(e.currentTarget.value)} placeholder="Choose a report" groups={groups} />
          </Field>
        )}

        {isFree && chosen?.downloadHref ? (
          <div role="status" className="grid gap-5 rounded-card border border-forest/20 bg-mint px-6 py-7 sm:flex sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-[16px] font-semibold leading-relaxed text-ink">
              <PartyPopper aria-hidden className="mt-0.5 size-6 shrink-0 text-forest" strokeWidth={2.25} />
              {freeDownloadText}
            </p>
            <a href={chosen.downloadHref} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-[15px] font-bold text-white transition-colors hover:bg-deep">
              <Download aria-hidden className="size-[18px]" strokeWidth={2.5} /> Download
            </a>
          </div>
        ) : (
          <>
            {report === REPORT_OTHER && !locked ? (
              <Field name="describe" label="Describe the report" hint="Its title, year or topic, as best you can." error={err("describe")} state={live}>
                <Input type="text" maxLength={200} />
              </Field>
            ) : null}
            <div className="grid gap-7 md:grid-cols-2">
              <Field name="fullName" label="Your name" error={err("fullName")} state={live}>
                <Input type="text" autoComplete="name" maxLength={100} />
              </Field>
              <Field name="organisation" label="Organisation" optional error={err("organisation")} state={live}>
                <Input type="text" autoComplete="organization" maxLength={120} />
              </Field>
              <Field name="email" label="Email address" hint="We send the report here." error={err("email")} state={live}>
                <Input type="email" autoComplete="email" inputMode="email" spellCheck={false} maxLength={254} />
              </Field>
              <Field name="country" label="Country" error={err("country")} state={live}>
                <CountrySelect priority={PRESENCE_FIRST} defaultValue={fieldValue(state, "country") ?? ""} />
              </Field>
            </div>
            <Field
              name="reason"
              label="Why would you like this report?"
              hint={`${REPORT_REASON_MIN} to ${REPORT_REASON_MAX.toLocaleString("en")} characters. For example: research, a funding review or partnership due diligence.`}
              counter={{ max: REPORT_REASON_MAX }}
              error={err("reason")}
              state={live}
            >
              <Textarea rows={5} maxLength={REPORT_REASON_MAX + 200} />
            </Field>
            <Checkbox
              name="consent"
              label={
                <>
                  Haven may contact me about this request. I have read the <Link href={links.privacy}>Privacy Policy</Link>.
                </>
              }
              error={err("consent")}
            />
            <Honeypot />
            <Turnstile action="report_request" />
            <div className="flex flex-col items-start gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[380px] text-[14px] leading-relaxed text-body">We usually reply within {responseTime}.</p>
              <SubmitButton pendingLabel="Sending…" icon="send" size="lg" className="w-full sm:w-auto">
                Send Request
              </SubmitButton>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
