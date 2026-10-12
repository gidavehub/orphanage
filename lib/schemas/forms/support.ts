// The Request Support form (/get-support/request; public-pages §3.6, data-model §4.2, PLAN D79–D82).
// Isomorphic: the client validates each step with these schemas (on blur and on Continue) and the
// Server Action is authoritative. Field names are the FormData names the form posts.
//
// `category` accepts the form-only `child_protection` and `immediateDanger` may be "yes": both are
// routed by the intake to safeguardingConcerns only (D79). Category extras are all optional.
// Cross-field rules (a way to reach the person, the preferred method matching a detail given, the
// "other" relationship, the safe-contact note) live in `supportCrossCheck`, which runs on raw form
// values in the browser and on parsed values on the server.

import { z } from "zod";
import type { DayPeriod, Weekday } from "@/lib/model/domain/support";
import { AGE_BANDS, CONTACT_METHODS, CURRENCIES, RELATIONSHIPS, URGENCY3, type ContactMethod, type Relationship } from "@/lib/model/enums";
import type { FieldErrors } from "@/lib/forms/types";
import { CONTACT_METHOD_LABEL } from "@/lib/model/labels";
import {
  consentSchema,
  contactMethodSchema,
  countrySchema,
  emailSchema,
  phoneSchema,
  str,
  supportFormCategorySchema,
} from "@/lib/schemas/common";

/* ── Small shared building blocks (also used by the concern and contact forms) ─────────────── */

type Loose = string | string[] | null | undefined;

function blank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** An optional value: empty, blank, missing or null becomes null; anything else must pass `schema`. */
export function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v), schema.nullable());
}

/** Optional single-choice: "" → null. */
export function optionalEnum<const T extends readonly [string, ...string[]]>(values: T, message = "Please choose one of the options.") {
  return optional(z.enum(values, { error: message }));
}

/** Optional phone ("" → null), spaces removed. */
export const optionalPhoneSchema = optional(phoneSchema);

/** Optional email ("" → null). */
export const optionalEmailSchema = optional(emailSchema);

/** Optional whole number from a text field ("" → null). */
export function optionalInt(min: number, max: number) {
  return optional(
    z
      .string()
      .regex(/^\d{1,9}$/, { error: "Please enter a whole number." })
      .transform(Number)
      .pipe(z.number().min(min, { error: `Please enter ${min} or more.` }).max(max, { error: `Please enter ${max} or less.` })),
  );
}

/** Repeated form keys (checkbox pills, upload tokens): a string or an array → a de-duplicated array. */
export function listOf<T extends z.ZodType<string>>(item: T, max: number, tooMany = `Please choose at most ${max}.`) {
  return z
    .preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : []), z.array(item).max(max, { error: tooMany }))
    .transform((xs) => [...new Set(xs)] as z.output<T>[]);
}

/** Yes / No / Not sure answers. */
export const YES_NO_UNSURE_VALUES = ["yes", "no", "unsure"] as const;

/** First message per field from a zod error (form-level issues under "_form"). */
function issuesToErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

export type CrossIssue = { field: string; message: string };

/**
 * Validates one step: the step's own fields (picked from the base object) plus the cross-field rules
 * that land on those fields. `raw` is the form's values as strings (repeated keys as arrays).
 */
export function validateFields(
  base: z.ZodObject,
  fields: readonly string[],
  raw: Record<string, Loose>,
  cross?: (raw: Record<string, Loose>) => CrossIssue[],
): FieldErrors {
  const mask = Object.fromEntries(fields.filter((f) => f in base.shape).map((f) => [f, true])) as Record<string, true>;
  const picked = base.pick(mask);
  const parsed = picked.safeParse(raw);
  const errors: FieldErrors = parsed.success ? {} : issuesToErrors(parsed.error);
  for (const issue of cross?.(raw) ?? []) {
    if (fields.includes(issue.field) && errors[issue.field] === undefined) errors[issue.field] = issue.message;
  }
  return errors;
}

/** Adds cross-field issues to a zod refinement context. */
export function addCrossIssues(ctx: z.RefinementCtx, issues: CrossIssue[]): void {
  for (const i of issues) ctx.addIssue({ code: "custom", path: [i.field], message: i.message });
}

/** "Choose how we contact you" must match a detail that was given. */
export function contactMethodIssue(method: unknown, email: unknown, phone: unknown, field: string): CrossIssue | null {
  if (typeof method !== "string" || !(CONTACT_METHODS as readonly string[]).includes(method)) return null;
  const label = CONTACT_METHOD_LABEL[method as ContactMethod];
  if (method === "email" && blank(email)) return { field, message: "You chose email: please add your email address, or choose another way." };
  if (method !== "email" && blank(phone)) return { field, message: `You chose ${label}: please add a phone number, or choose another way.` };
  return null;
}

/* ── Request Support ─────────────────────────────────────────────────────────────────────────── */

export const EXPLANATION_MIN = 30;
export const EXPLANATION_MAX = 2000;
export const MAX_UPLOADS = 5;
/** The legal category allows three documents (public-pages §3.6); education and medical five (D96). */
export const LEGAL_MAX_UPLOADS = 3;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const satisfies readonly Weekday[];
export const DAY_PERIODS = ["morning", "afternoon", "evening"] as const satisfies readonly DayPeriod[];
export const EDUCATION_LEVELS = ["pre_school", "primary", "secondary", "vocational", "other"] as const;
export const EDUCATION_NEEDS = ["fees", "uniform", "materials", "hygiene", "nutrition", "bedding", "devices"] as const;
export const MEDICAL_NEEDS = ["referral", "treatment_cost", "supplies", "information"] as const;
export const LEGAL_MATTERS = ["custody_guardianship", "documentation", "inheritance", "abuse_proceedings", "other"] as const;
export const COUNSELLING_FOR = ["child", "parent_or_caregiver", "family"] as const;
export const SAFE_TO_CONTACT = ["yes", "careful"] as const;
export const DANGER_ANSWERS = ["yes", "no"] as const;

/** Child age bands offered on the support form (D82). */
export const SUPPORT_AGE_BANDS = AGE_BANDS;

export const supportFields = z.object({
  // Step 1: what do you need help with?
  category: supportFormCategorySchema,
  urgency: z.enum(URGENCY3, { error: "Please tell us how urgent this is." }),
  immediateDanger: z.enum(DANGER_ANSWERS, { error: "Please tell us whether anyone is in immediate danger." }),

  // Step 2: tell us what's happening (+ category extras, all optional)
  explanation: str(EXPLANATION_MAX, { min: EXPLANATION_MIN, multiline: true }),
  childAge: optionalEnum(SUPPORT_AGE_BANDS, "Please choose an age range."),
  childrenCount: optionalInt(1, 30),
  educationLevel: optionalEnum(EDUCATION_LEVELS),
  educationNeeds: listOf(z.enum(EDUCATION_NEEDS, { error: "Please choose from the list." }), EDUCATION_NEEDS.length),
  amountNeeded: optionalInt(1, 10_000_000_000),
  amountNeededCurrency: optionalEnum(CURRENCIES, "Please choose a currency."),
  medicalNeed: optionalEnum(MEDICAL_NEEDS),
  legalMatter: optionalEnum(LEGAL_MATTERS),
  counsellingFor: optionalEnum(COUNSELLING_FOR),
  counsellingLanguage: optional(str(40)),
  counsellingDays: listOf(z.enum(WEEKDAYS, { error: "Please choose from the days shown." }), 7),
  counsellingPeriods: listOf(z.enum(DAY_PERIODS, { error: "Please choose from the times shown." }), 3),
  counsellingVideo: optionalEnum(YES_NO_UNSURE_VALUES),
  counsellingTimes: optional(str(200)),
  timezone: optional(z.string().regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/).max(64)),
  householdSize: optionalInt(1, 40),
  childrenInHousehold: optionalInt(0, 30),
  upload: listOf(z.string().min(10).max(2048), MAX_UPLOADS, `Please attach at most ${MAX_UPLOADS} files.`),

  // Step 3: about you
  fullName: str(120, { min: 2 }),
  relationship: z.enum(RELATIONSHIPS, { error: "Please choose your relationship to the child." }),
  relationshipOther: optional(str(60)),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  country: countrySchema,
  locality: optional(str(80)),
  preferredContact: contactMethodSchema,
  safeToContact: z.enum(SAFE_TO_CONTACT, { error: "Please tell us whether it is safe to contact you on these details." }),
  bestTimes: optional(str(120)),

  // Step 4: review and send
  consentToContact: consentSchema,
  privacyAcknowledged: consentSchema,
});

/** Cross-field rules, on raw strings (browser) or parsed values (server). */
export function supportCrossCheck(v: Record<string, unknown>): CrossIssue[] {
  const out: CrossIssue[] = [];
  if (blank(v.email) && blank(v.phone)) out.push({ field: "phone", message: "Please give a phone number or an email so we can reach you." });
  const method = contactMethodIssue(v.preferredContact, v.email, v.phone, "preferredContact");
  if (method) out.push(method);
  if (v.relationship === "other" && blank(v.relationshipOther)) out.push({ field: "relationshipOther", message: "Please tell us your relationship to the child." });
  if (v.safeToContact === "careful" && blank(v.bestTimes)) out.push({ field: "bestTimes", message: "Please tell us the safest time or way to reach you." });
  if (!blank(v.amountNeeded) && blank(v.amountNeededCurrency)) out.push({ field: "amountNeeded", message: "Please choose a currency for the amount." });
  if (v.category === "legal") {
    const n = Array.isArray(v.upload) ? v.upload.length : blank(v.upload) ? 0 : 1;
    if (n > LEGAL_MAX_UPLOADS) out.push({ field: "upload", message: `Please attach at most ${LEGAL_MAX_UPLOADS} documents for a legal request.` });
  }
  return out;
}

export const supportSchema = supportFields.superRefine((v, ctx) => addCrossIssues(ctx, supportCrossCheck(v)));

export type SupportInput = z.input<typeof supportFields>;
export type SupportData = z.output<typeof supportFields>;
export type SupportField = keyof SupportInput;

/** The four steps, their headings and the fields each one validates (in on-screen order). */
export const SUPPORT_STEPS: ReadonlyArray<{ id: string; label: string; title: string; fields: readonly SupportField[] }> = [
  { id: "need", label: "Your need", title: "What do you need help with?", fields: ["category", "urgency", "immediateDanger"] },
  {
    id: "situation",
    label: "What's happening",
    title: "Tell us what's happening",
    fields: [
      "explanation",
      "childAge",
      "childrenCount",
      "educationLevel",
      "educationNeeds",
      "amountNeeded",
      "medicalNeed",
      "legalMatter",
      "counsellingFor",
      "counsellingLanguage",
      "counsellingDays",
      "counsellingPeriods",
      "counsellingVideo",
      "counsellingTimes",
      "householdSize",
      "childrenInHousehold",
      "upload",
    ],
  },
  {
    id: "you",
    label: "About you",
    title: "About you",
    fields: ["fullName", "relationship", "relationshipOther", "phone", "email", "country", "locality", "preferredContact", "safeToContact", "bestTimes"],
  },
  { id: "review", label: "Review and send", title: "Review and send", fields: ["consentToContact", "privacyAcknowledged"] },
];

/** Validates one step of the request form in the browser. */
export function validateSupportStep(step: number, raw: Record<string, Loose>): FieldErrors {
  const s = SUPPORT_STEPS[step];
  return s ? validateFields(supportFields, s.fields, raw, supportCrossCheck) : {};
}

/** Text fields echoed back after a server error (never upload tokens or consent ticks). */
export const SUPPORT_ECHO_KEYS: string[] = SUPPORT_STEPS.flatMap((s) => s.fields).filter(
  (f) => f !== "upload" && f !== "consentToContact" && f !== "privacyAcknowledged",
);

/** Relationship choices on the request form, in the order public-pages §3.6 lists them. */
export const SUPPORT_RELATIONSHIPS: readonly Relationship[] = [
  "parent",
  "guardian",
  "grandparent",
  "relative",
  "teacher",
  "social_worker",
  "professional",
  "community_member",
  "young_person",
  "institution",
  "other",
];
