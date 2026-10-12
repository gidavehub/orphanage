// The Report a Concern form (/report-a-concern; public-pages §3.7, data-model §4.2.2, PLAN D79,
// D81, D82, D94, D108). Isomorphic: the client validates each step, the Server Action is
// authoritative. Anonymous reports carry no personal fields at all: the server drops them even if
// a browser sends them. The reporter email is only ever sent when the safe follow-up method is
// email AND `emailConfirmationAllowed` is ticked (D108).

import { z } from "zod";
import type { FieldErrors } from "@/lib/forms/types";
import { CONCERN_TYPES, CONTACT_METHODS, RELATIONSHIPS, YES_NO_UNSURE, type AgeBand, type Relationship } from "@/lib/model/enums";
import { checkboxSchema, consentSchema, countrySchema, str } from "@/lib/schemas/common";
import {
  addCrossIssues,
  contactMethodIssue,
  listOf,
  optional,
  optionalEmailSchema,
  optionalEnum,
  optionalPhoneSchema,
  validateFields,
  type CrossIssue,
} from "./support";

export const NARRATIVE_MIN = 30;
export const NARRATIVE_MAX = 4000;

/** The child's approximate age: every band except adults (D82). */
export const CONCERN_AGE_BANDS = ["0-4", "5-9", "10-14", "15-17", "unknown"] as const satisfies readonly AgeBand[];

/** The nature-of-concern pills, in the order public-pages §3.7 lists them. */
export const CONCERN_TYPE_ORDER = [
  "physical",
  "sexual",
  "neglect",
  "emotional",
  "exploitation",
  "child_labour",
  "trafficking",
  "harmful_practice",
  "online",
  "bullying",
  "other",
] as const satisfies readonly (typeof CONCERN_TYPES)[number][];

export const REPORTER_MODES = ["named", "anonymous"] as const;
export type ReporterMode = (typeof REPORTER_MODES)[number];

/** Relationship choices on the concern form. */
export const CONCERN_RELATIONSHIPS: readonly Relationship[] = [
  "parent",
  "guardian",
  "grandparent",
  "relative",
  "teacher",
  "professional",
  "social_worker",
  "community_member",
  "young_person",
  "other",
];

export const concernFields = z.object({
  // Step 1: the child and the concern
  childAge: z.enum(CONCERN_AGE_BANDS, { error: "Please choose the child's approximate age." }),
  country: countrySchema,
  area: optional(str(300)),
  concernTypes: listOf(z.enum(CONCERN_TYPES, { error: "Please choose from the list." }), CONCERN_TYPES.length).refine((xs) => xs.length > 0, {
    error: "Please choose at least one kind of concern.",
  }),
  narrative: str(NARRATIVE_MAX, { min: NARRATIVE_MIN, multiline: true }),
  inDangerNow: z.enum(YES_NO_UNSURE, { error: "Please tell us whether the child is in danger now." }),
  authoritiesContacted: z.enum(YES_NO_UNSURE, { error: "Please tell us whether the authorities have been contacted." }),
  authorityDetails: optional(str(300)),

  // Step 2: about you
  reporterMode: z.enum(REPORTER_MODES, { error: "Please choose whether to share your details." }),
  name: optional(str(120)),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  relationship: optionalEnum(RELATIONSHIPS, "Please choose how you know the child."),
  followUpMethod: optionalEnum(CONTACT_METHODS, "Please choose a safe way for us to follow up."),
  followUpTimes: optional(str(200)),
  // An unticked box is simply absent from FormData: map it to null first, because zod 4 reports a
  // missing key as "nonoptional" for checkboxSchema's union-with-transform inside an object.
  emailConfirmationAllowed: z.preprocess((v) => (v === undefined ? null : v), checkboxSchema),

  // Step 3: consent and send
  consent: consentSchema,
});

function blank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Rules that only apply when the reporter shares their details. */
export function concernCrossCheck(v: Record<string, unknown>): CrossIssue[] {
  if (v.reporterMode !== "named") return [];
  const out: CrossIssue[] = [];
  if (blank(v.name) || String(v.name).trim().length < 2) out.push({ field: "name", message: "Please tell us your name, or choose to stay anonymous." });
  if (blank(v.email) && blank(v.phone)) out.push({ field: "phone", message: "Please give a phone number or an email, or choose to stay anonymous." });
  if (blank(v.relationship)) out.push({ field: "relationship", message: "Please choose how you know the child." });
  if (blank(v.followUpMethod)) out.push({ field: "followUpMethod", message: "Please choose a safe way for us to follow up." });
  else {
    const m = contactMethodIssue(v.followUpMethod, v.email, v.phone, "followUpMethod");
    if (m) out.push(m);
  }
  if (blank(v.followUpTimes)) out.push({ field: "followUpTimes", message: "Please tell us when it is safe to contact you." });
  return out;
}

export const concernSchema = concernFields.superRefine((v, ctx) => addCrossIssues(ctx, concernCrossCheck(v)));

export type ConcernInput = z.input<typeof concernFields>;
export type ConcernData = z.output<typeof concernFields>;
export type ConcernField = keyof ConcernInput;

export const CONCERN_STEPS: ReadonlyArray<{ id: string; label: string; title: string; fields: readonly ConcernField[] }> = [
  {
    id: "concern",
    label: "The concern",
    title: "The child and the concern",
    fields: ["childAge", "country", "area", "concernTypes", "narrative", "inDangerNow", "authoritiesContacted", "authorityDetails"],
  },
  {
    id: "you",
    label: "About you",
    title: "About you",
    fields: ["reporterMode", "name", "phone", "email", "relationship", "followUpMethod", "followUpTimes", "emailConfirmationAllowed"],
  },
  { id: "send", label: "Consent and send", title: "Consent and send", fields: ["consent"] },
];

export function validateConcernStep(step: number, raw: Record<string, string | string[] | null | undefined>): FieldErrors {
  const s = CONCERN_STEPS[step];
  return s ? validateFields(concernFields, s.fields, raw, concernCrossCheck) : {};
}

/** Echoed after a server error (never the consent tick). */
export const CONCERN_ECHO_KEYS: string[] = CONCERN_STEPS.flatMap((s) => s.fields).filter((f) => f !== "consent");
