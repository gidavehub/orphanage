// The volunteer application (/get-involved/volunteer; public-pages §3.17, data-model §4.4). Isomorphic:
// the client validates each step with this schema and the Server Action is authoritative. Field names
// map onto the VolunteerApplication record (lib/model/domain/engagement.ts):
//   fullName, email, phone, country, locality → applicant; isAdult; languages; interests; skills;
//   mode + days + hours → availability; workedWithChildren (+ note); motivation; heardFrom;
//   consent → consentToContact; privacy → privacyAcknowledged; safeguarding → safeguardingAcknowledged
//   (and backgroundCheckConsent). No CV upload: it is collected at screening (minimal data, §15).

import { z } from "zod";
import { HEARD_FROM, VOLUNTEER_DAYS, VOLUNTEER_HOURS, VOLUNTEER_INTERESTS, VOLUNTEER_MODES } from "@/lib/model/enums";
import { consentSchema, countrySchema, emailSchema, optionalStr, phoneSchema, str } from "@/lib/schemas/common";

export const VOLUNTEER_MOTIVATION_MIN = 30;
export const VOLUNTEER_MOTIVATION_MAX = 1000;
export const VOLUNTEER_SKILLS_MAX = 1000;
export const VOLUNTEER_LANGUAGES_MAX = 6;

/** Language chips offered on the form (public-pages §3.17 [draft]); "Other" lets people type more. */
export const VOLUNTEER_LANGUAGE_OPTIONS = ["English", "Wolof", "Mandinka", "Fula", "French", "Arabic", "Hindi or Urdu", "Tagalog", "Other"] as const;

const MSG = {
  adult: "Volunteering with Haven is for adults (18 or older).",
  interests: "Please choose at least one way you would like to help.",
  mode: "Please choose where you could help.",
  hours: "Please choose roughly how many hours a week you could give.",
  worked: "Please tell us whether you have worked with children before.",
  safeguarding: "Please confirm that you understand the safeguarding checks.",
} as const;

/** A string or repeated keys → a de-duplicated array (empty when missing). */
const many = <T extends z.ZodType>(item: T, max: number, msg?: string) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : []), z.array(item).max(max, msg ? { error: msg } : undefined))
    .transform((xs) => [...new Set(xs as unknown[])] as z.output<T>[]);

const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .preprocess((v) => (v === undefined ? null : v), z.union([z.literal(""), z.enum(values), z.null()]))
    .transform((v) => (v ? (v as T[number]) : null));

export const volunteerSchema = z
  .object({
    fullName: str(100, { min: 2 }),
    email: emailSchema,
    phone: phoneSchema,
    country: countrySchema,
    locality: optionalStr(80),
    isAdult: z.literal("on", { error: MSG.adult }),
    languages: many(z.enum(VOLUNTEER_LANGUAGE_OPTIONS), VOLUNTEER_LANGUAGES_MAX, `Please choose at most ${VOLUNTEER_LANGUAGES_MAX} languages.`),
    interests: many(z.enum(VOLUNTEER_INTERESTS), VOLUNTEER_INTERESTS.length).pipe(z.array(z.enum(VOLUNTEER_INTERESTS)).min(1, { error: MSG.interests })),
    skills: optionalStr(VOLUNTEER_SKILLS_MAX, { multiline: true }),
    mode: z.enum(VOLUNTEER_MODES, { error: MSG.mode }),
    days: many(z.enum(VOLUNTEER_DAYS), VOLUNTEER_DAYS.length),
    hours: z.enum(VOLUNTEER_HOURS, { error: MSG.hours }),
    workedWithChildren: z.enum(["yes", "no"], { error: MSG.worked }),
    workedWithChildrenNote: optionalStr(500, { multiline: true }),
    motivation: str(VOLUNTEER_MOTIVATION_MAX, { min: VOLUNTEER_MOTIVATION_MIN, multiline: true }),
    heardFrom: optionalEnum(HEARD_FROM),
    consent: consentSchema,
    privacy: consentSchema,
    safeguarding: z.literal("on", { error: MSG.safeguarding }),
  });

export type VolunteerInput = z.input<typeof volunteerSchema>;
export type VolunteerData = z.output<typeof volunteerSchema>;
export type VolunteerField = keyof VolunteerInput;

/** The three steps of the form and the fields each one validates. */
export const VOLUNTEER_STEPS: Array<{ id: string; label: string; fields: VolunteerField[] }> = [
  { id: "about", label: "About you", fields: ["fullName", "email", "phone", "country", "locality", "isAdult", "languages"] },
  { id: "help", label: "How you'd help", fields: ["interests", "skills", "mode", "days", "hours", "workedWithChildren", "workedWithChildrenNote", "motivation", "heardFrom"] },
  { id: "consent", label: "Consent", fields: ["consent", "privacy", "safeguarding"] },
];

/** Every field in form order (error summary and focus). */
export const VOLUNTEER_FIELD_ORDER: VolunteerField[] = VOLUNTEER_STEPS.flatMap((s) => s.fields);

/** Fields echoed back after a server error (never the consent ticks). */
export const VOLUNTEER_ECHO_KEYS: VolunteerField[] = VOLUNTEER_FIELD_ORDER.filter((k) => k !== "consent" && k !== "privacy" && k !== "safeguarding" && k !== "isAdult");
