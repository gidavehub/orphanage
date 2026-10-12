import "server-only";

// The public intake pipeline (data-model §10.1–10.4, PLAN D26, D79, D94). Every public form (Server
// Action) and the JSON endpoints delegate here through lib/server/intake/<form>.ts:
//   backend available? → form open? → honeypot + time trap → per-IP-hash rate limit → optional
//   Turnstile → zod → create (one transaction: record, events, audit, outbox) → after(drainOutbox)
// Bots get a success-looking answer with no reference and nothing stored, EXCEPT the concern form
// (keepSuspected), which stores the submission flagged so a genuine concern is never lost; an
// over-limit concern is accepted the same way. Support and concern fail open when Turnstile is
// unreachable. No IP or user agent is ever stored; the IP is only hashed for the rate limit.

import { headers } from "next/headers";
import type { z } from "zod";
import { formError, valuesOf, zodToFieldErrors, type FormState } from "@/lib/forms/types";
import { CONTROL_FIELDS, TURNSTILE_FIELD } from "@/lib/forms/spam";
import type { ConsentStamp, Millis } from "@/lib/model/enums";
import { storeAvailable } from "@/lib/server/db";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { drainAfterResponse } from "@/lib/server/email/outbox";
import { log } from "@/lib/server/log";
import { ipHash } from "@/lib/server/security/hmac";
import { rateLimit, type RateLimitName } from "@/lib/server/security/ratelimit";
import { SealingUnavailableError } from "@/lib/server/security/seal";
import { clientIp, spamVerdict, type SpamVerdict } from "@/lib/server/security/spam";
import { turnstileAccepts, turnstileEnabled, verifyTurnstile, type TurnstileAction, type TurnstileResult } from "@/lib/server/security/turnstile";

/** The privacy notice version stamped on every consent tick (data-model §2). */
export const PRIVACY_NOTICE_VERSION = "privacy-2026-10";

/** A consent tick stamped with the notice version the person saw. */
export function consentStamp(now: Millis = Date.now(), noticeVersion: string = PRIVACY_NOTICE_VERSION): ConsentStamp {
  return { at: now, noticeVersion };
}

export type IntakeForm =
  | "support"
  | "concern"
  | "contact"
  | "volunteer"
  | "partnership"
  | "report_request"
  | "newsletter"
  | "data_request"
  | "story"
  | "donation"
  | "manage_link";

const RATE_LIMIT: Record<IntakeForm, RateLimitName> = {
  support: "support",
  concern: "concern",
  contact: "contact",
  volunteer: "volunteer",
  partnership: "partnership",
  report_request: "report_request",
  newsletter: "newsletter",
  data_request: "data_request",
  story: "story",
  donation: "donation",
  manage_link: "manage_link",
};

const TURNSTILE_ACTION: Record<IntakeForm, TurnstileAction> = {
  support: "support",
  concern: "concern",
  contact: "contact",
  volunteer: "volunteer",
  partnership: "partner",
  report_request: "report_request",
  newsletter: "newsletter",
  data_request: "data_request",
  story: "story",
  donation: "donate",
  manage_link: "manage_link",
};

export type IntakeContext = {
  form: IntakeForm;
  now: Millis;
  /** Daily-salted hash of the client IP (never the IP). */
  ipHash: string;
  spam: SpamVerdict;
  /** The per-IP limit was exceeded (only reachable with keepSuspected). */
  rateLimited: boolean;
  challenge: TurnstileResult;
  /** Keep-and-flag forms: a bot signal or an over-limit submission. Store it as suspectedSpam. */
  suspectedSpam: boolean;
};

export type IntakeCreated<D = undefined> = { reference?: string; title?: string; message?: string; data?: D };

export type IntakeOptions<S extends z.ZodType, D> = {
  form: IntakeForm;
  /** FormData from a Server Action, or a parsed JSON body from a route handler. */
  input: FormData | Record<string, unknown>;
  schema: S;
  /** Writes the record(s) in one transaction and returns what the success screen shows. */
  create: (data: z.output<S>, ctx: IntakeContext) => Promise<IntakeCreated<D>>;
  /** Concern form: keep bot hits and over-limit submissions, flagged (D94). */
  keepSuspected?: boolean;
  /** Paused intake (settings/forms): return false or a message to show instead of the form. */
  isOpen?: () => Promise<boolean | string>;
  /** FormData → object for zod (default: repeated keys become arrays, files are skipped). */
  toObject?: (fd: FormData) => Record<string, unknown>;
  /** Field names to echo back on error (default: every text field except control fields). */
  echoKeys?: string[];
  /** Route handlers pass the request (for the IP); Server Actions omit it. */
  request?: Request;
  /** What a bot sees (default: a success with no reference). */
  fakeSuccess?: () => FormState<string, D>;
  rateLimitedMessage?: string;
};

/** FormData → plain object: repeated keys become arrays; files and Next's internal fields are skipped. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    if (values.length === 0) continue;
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

async function requestIp(req?: Request): Promise<string> {
  if (req) return clientIp(req.headers);
  try {
    return clientIp(await headers());
  } catch {
    return "local";
  }
}

function readField(input: FormData | Record<string, unknown>, key: string): string | null {
  const v = input instanceof FormData ? input.get(key) : input[key];
  return typeof v === "string" ? v : null;
}

/** Runs the pipeline and returns the FormState for useActionState (or the JSON body of a route). */
export async function runIntake<S extends z.ZodType, D = undefined>(opts: IntakeOptions<S, D>): Promise<FormState<string, D>> {
  const isForm = opts.input instanceof FormData;
  const values = isForm ? valuesOf(opts.input as FormData, opts.echoKeys) : {};
  const fail = (code: Parameters<typeof formError>[0], message?: string, extra?: Parameters<typeof formError>[2]) =>
    formError(code, message, { values, ...extra }) as FormState<string, D>;

  if (!storeAvailable()) return fail("unavailable");

  try {
    if (opts.isOpen) {
      const open = await opts.isOpen();
      if (open !== true) return fail("closed", typeof open === "string" && open ? open : undefined);
    }

    const now = Date.now();
    const spam = spamVerdict(opts.input);
    if (spam.bot && !opts.keepSuspected) {
      log.info("intake.bot_discarded", { form: opts.form, reason: spam.reason });
      return opts.fakeSuccess ? opts.fakeSuccess() : ({ status: "success" } as FormState<string, D>);
    }

    const ip = await requestIp(opts.request);
    const hash = ipHash(ip, now);
    const rl = await rateLimit(RATE_LIMIT[opts.form], hash, now);
    if (!rl.ok && !opts.keepSuspected) return fail("rate_limited", opts.rateLimitedMessage);

    let challenge: TurnstileResult = "off";
    if (turnstileEnabled()) {
      const action = TURNSTILE_ACTION[opts.form];
      challenge = await verifyTurnstile(readField(opts.input, TURNSTILE_FIELD), action);
      if (!turnstileAccepts(challenge, action)) return fail("challenge");
    }

    const raw = isForm ? (opts.toObject ?? formDataToObject)(opts.input as FormData) : { ...(opts.input as Record<string, unknown>) };
    for (const k of CONTROL_FIELDS) if (k !== "submissionId" && k !== "_elapsed") delete raw[k];
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) return fail("validation", undefined, { fieldErrors: zodToFieldErrors(parsed.error) });

    const ctx: IntakeContext = {
      form: opts.form,
      now,
      ipHash: hash,
      spam,
      rateLimited: !rl.ok,
      challenge,
      suspectedSpam: Boolean(opts.keepSuspected && (spam.bot || !rl.ok)),
    };
    const created = await opts.create(parsed.data as z.output<S>, ctx);
    drainAfterResponse();
    return {
      status: "success",
      ...(created.reference ? { reference: created.reference } : {}),
      ...(created.title ? { title: created.title } : {}),
      ...(created.message ? { message: created.message } : {}),
      ...(created.data !== undefined ? { data: created.data } : {}),
    } as FormState<string, D>;
  } catch (err) {
    if (err instanceof BackendUnavailableError || err instanceof SealingUnavailableError) return fail("unavailable");
    log.error("intake.failed", { form: opts.form, err });
    return fail("server");
  }
}
