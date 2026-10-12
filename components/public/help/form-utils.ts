// Small isomorphic helpers shared by the help forms (support, concern, contact).

import type { FieldErrors, FormState } from "@/lib/forms/types";
import { CONTROL_FIELDS } from "@/lib/forms/spam";

export type RawValues = Record<string, string | string[]>;

/** The form's current text values: repeated keys become arrays; files and control fields are skipped. */
export function readForm(form: HTMLFormElement | null): RawValues {
  const out: RawValues = {};
  if (!form) return out;
  const fd = new FormData(form);
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION") || CONTROL_FIELDS.includes(key)) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    if (values.length === 0) continue;
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

/** "awa@example.org" → "a***@example.org" (shown on success screens, never sent anywhere). */
export function maskEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  return `${e[0]}***${e.slice(at)}`;
}

export function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export function list(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

/** The index of the first step that holds one of these errors (or -1). */
export function firstStepWithError(errors: FieldErrors, steps: ReadonlyArray<{ fields: readonly string[] }>): number {
  const keys = Object.keys(errors).filter((k) => errors[k]);
  return steps.findIndex((s) => s.fields.some((f) => keys.includes(f)));
}

/** Only the errors for the given fields, in the given order (keeps the error summary in screen order). */
export function pickErrors(errors: FieldErrors, order: readonly string[]): FieldErrors {
  const out: FieldErrors = {};
  for (const k of order) if (errors[k]) out[k] = errors[k];
  if (errors._form) out._form = errors._form;
  return out;
}

/** The form-level sentence for a failed submit (public-pages §3.6 states). */
export function failureMessage(
  state: FormState<string, unknown>,
  o: { phone: string; email: string; noun: "request" | "report" | "message" },
): string | undefined {
  if (state.status !== "error") return undefined;
  switch (state.code) {
    case "validation":
      return state.fieldErrors && Object.keys(state.fieldErrors).length ? undefined : state.message;
    case "server":
      return `Something went wrong and your ${o.noun} was not sent. Your answers are still here, so please try again. If it keeps happening, call us on ${o.phone} or email ${o.email}.`;
    case "rate_limited":
      return `${state.message} If you need help now, call us on ${o.phone} or email ${o.email}.`;
    case "unavailable":
    case "closed":
      return `${state.message} You can call us on ${o.phone} or email ${o.email}.`;
    default:
      return state.message;
  }
}
