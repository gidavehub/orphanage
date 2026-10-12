// The "Share your story" form (/stories/share; public-pages §3.14, PLAN D58). Isomorphic: the client
// validates on blur and on submit with this schema, and the server action is authoritative.
// Field names map onto the StorySubmission record (lib/model/domain/engagement.ts):
//   name + email + phone → the sealed `contact` (used only to confirm before publishing);
//   anonymous → publishWithoutName (and displayName null); role → submitterRole; country; programme →
//   programmeId; story; aboutMyChild + guardian → parentOrGuardian; publishConsent → publishConsent
//   stamp; privacy → privacyAcknowledged stamp; photo → at most one upload token from /api/uploads
//   (an adult-only photo, claimed from quarantine by the intake; D58, D96).

import { z } from "zod";
import { STORY_SUBMITTER_ROLES, PROGRAMME_IDS, type StorySubmitterRole } from "@/lib/model/enums";
import { checkboxSchema, consentSchema, countrySchema, emailSchema, phoneSchema, str } from "@/lib/schemas/common";

export const STORY_MIN = 50;
export const STORY_MAX = 1500;
export const STORY_NAME_MAX = 80;
/** One optional photo of the adult telling the story (D58). */
export const STORY_MAX_PHOTOS = 1;

/** "You are a…" choices, in form order, with a line of help each. */
export const STORY_ROLE_OPTIONS: Record<StorySubmitterRole, { label: string; description: string }> = {
  beneficiary: { label: "Beneficiary or family member", description: "Haven supported you, your child or your family." },
  donor: { label: "Donor", description: "You give to Haven, once or regularly." },
  volunteer: { label: "Volunteer", description: "You give your time or skills with us." },
  partner: { label: "Partner", description: "Your school, clinic or organisation works with us." },
  professional: { label: "Professional", description: "A teacher, counsellor, nurse or lawyer who saw the difference." },
};

const MSG = {
  role: "Please choose the option that describes you best.",
  contact: "Please give an email address or a phone number, so we can check with you before anything is published.",
  guardian: "Please confirm that you are the child's parent or legal guardian, or untick “My story is about my own child”.",
  programme: "Please choose a programme from the list, or leave it empty.",
} as const;

/** Optional email: empty or missing becomes null. */
const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.union([z.literal(""), emailSchema]))
  .transform((v) => (v === "" ? null : v));

/** Optional phone: empty or missing becomes null. */
const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.union([z.literal(""), phoneSchema]))
  .transform((v) => (v === "" ? null : v));

/** Upload tokens (a string or repeated keys) → a de-duplicated list of at most `STORY_MAX_PHOTOS`. */
const photoTokens = z
  .preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : []), z.array(z.string().min(10).max(2048)).max(STORY_MAX_PHOTOS, { error: "Please attach one photo at most." }))
  .transform((xs) => [...new Set(xs)]);

/** Optional programme id: "" becomes null. */
const optionalProgramme = z
  .union([z.literal(""), z.enum(PROGRAMME_IDS, { error: MSG.programme }), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));

export const storySchema = z
  .object({
    name: str(STORY_NAME_MAX, { min: 2 }),
    anonymous: checkboxSchema,
    role: z.enum(STORY_SUBMITTER_ROLES, { error: MSG.role }),
    country: countrySchema,
    programme: optionalProgramme,
    story: str(STORY_MAX, { min: STORY_MIN, multiline: true }),
    photo: photoTokens,
    email: optionalEmail,
    phone: optionalPhone,
    aboutMyChild: checkboxSchema,
    guardian: checkboxSchema,
    publishConsent: consentSchema,
    privacy: consentSchema,
  })
  .superRefine((d, ctx) => {
    if (!d.email && !d.phone) ctx.addIssue({ code: "custom", path: ["email"], message: MSG.contact });
    if (d.aboutMyChild && !d.guardian) ctx.addIssue({ code: "custom", path: ["guardian"], message: MSG.guardian });
  });

export type StoryInput = z.input<typeof storySchema>;
export type StoryData = z.output<typeof storySchema>;
export type StoryField = keyof StoryInput;

/** Text fields echoed back after an error (never the consent ticks or upload tokens). */
export const STORY_ECHO_KEYS: StoryField[] = ["name", "anonymous", "role", "country", "programme", "story", "email", "phone", "aboutMyChild"];

/** The order fields appear in, for the error summary and focus. */
export const STORY_FIELD_ORDER: StoryField[] = [
  "name",
  "anonymous",
  "role",
  "country",
  "programme",
  "story",
  "photo",
  "email",
  "phone",
  "aboutMyChild",
  "guardian",
  "publishConsent",
  "privacy",
];

/** "Amina Sowe" → "Amina S." (how a named story is credited; never a full surname). */
export function creditName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : "";
  const initial = last ? `${Array.from(last)[0]?.toLocaleUpperCase("en") ?? ""}.` : "";
  return `${first}${initial ? ` ${initial}` : ""}`.slice(0, 40);
}
