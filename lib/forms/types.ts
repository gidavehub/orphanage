// The one result contract for forms and mutations (PLAN D26). Isomorphic: NOT a 'use server' file.
// - FormState: every useActionState form, public and admin. `fieldErrors` holds the first message
//   per field as a string; `values` echo back what was typed so nothing is lost on an error.
// - ActionResult: admin content and transition mutations (save, publish, transition, …).
// Expected failures are return values, never throws.

import type { z } from "zod";
import type { Millis } from "@/lib/model/enums";
import { CONTROL_FIELDS } from "./spam";

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export type FormErrorCode = "validation" | "rate_limited" | "challenge" | "unavailable" | "closed" | "server";

export type FormState<K extends string = string, D = undefined> =
  | { status: "idle" }
  | { status: "error"; code: FormErrorCode; message: string; fieldErrors?: FieldErrors<K>; values?: Partial<Record<K, string>> }
  | { status: "success"; reference?: string; title?: string; message?: string; data?: D };

export const IDLE: FormState = { status: "idle" };

export type ActionError =
  | { kind: "validation"; fields: Record<string, string> }
  | { kind: "conflict"; message: string; current: { version: number; updatedBy: string; updatedAt: Millis } }
  | { kind: "forbidden"; message: string; paths?: string[] }
  | { kind: "blocked"; message: string; reasons: string[] }
  | { kind: "unavailable"; message: string }
  | { kind: "not_allowed"; message: string };

export type ActionResult<T = { version: number; at: Millis }> = { ok: true; data: T } | { ok: false; error: ActionError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError<T = { version: number; at: Millis }>(error: ActionError): ActionResult<T> {
  return { ok: false, error };
}

/** Shown wherever a write cannot happen because the data backend is not connected (backend "unavailable"). */
export const UNAVAILABLE_MESSAGE =
  "This part of the site is not switched on yet. Please email or call us, and we'll help straight away.";

const DEFAULT_MESSAGES: Record<FormErrorCode, string> = {
  validation: "Please check the highlighted fields and try again.",
  rate_limited: "You've sent several requests in a short time. Please wait a few minutes and try again.",
  challenge: "We couldn't confirm the form was sent by a person. Please try again.",
  unavailable: UNAVAILABLE_MESSAGE,
  closed: "This form is paused for now. Please email or call us instead.",
  server: "Something went wrong and your form was not sent. Your answers are still here, so please try again.",
};

/** First message per field path ("donor.email"), from a zod error. Form-level issues go under "_form". */
export function zodToFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_form";
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

/** An action's form data. Anyone can call an action directly with anything, so that reads as an empty form. */
export function formDataOf(fd: unknown): FormData {
  return fd instanceof FormData ? fd : new FormData();
}

export function formError(
  code: FormErrorCode,
  message?: string,
  extra?: { fieldErrors?: FieldErrors; values?: Record<string, string> },
): FormState {
  return {
    status: "error",
    code,
    message: message ?? DEFAULT_MESSAGES[code],
    ...(extra?.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
    ...(extra?.values ? { values: extra.values } : {}),
  };
}

export function formSuccess(reference?: string, message?: string): FormState {
  return {
    status: "success",
    ...(reference ? { reference } : {}),
    ...(message ? { message } : {}),
  };
}

const MAX_ECHO_LENGTH = 10_000;

/**
 * Text values from a submitted form, to echo back on error. Never files, never the honeypot or
 * other control fields, never Next's internal action fields. Repeated keys (checkbox groups) are
 * joined with commas.
 */
export function valuesOf(fd: FormData, keys?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const wanted = keys ? new Set(keys) : null;
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("$ACTION") || CONTROL_FIELDS.includes(key)) continue;
    if (wanted && !wanted.has(key)) continue;
    const v = value.slice(0, MAX_ECHO_LENGTH);
    out[key] = key in out ? `${out[key]},${v}` : v;
  }
  return out;
}
