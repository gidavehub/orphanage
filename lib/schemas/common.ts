// zod 4 primitives shared by every public form, admin input and content schema. Imported by client
// forms for inline errors; the server is authoritative. Rules (data-model §10.5): strings are trimmed,
// NFC-normalised, stripped of control characters (newlines kept only where multiline) and capped.

import { z } from "zod";
import { countries as worldCountries, spriteCountries } from "@/content/world";
import { isIsoCountry } from "@/lib/countries";
import {
  AGE_BANDS,
  CONTACT_METHODS,
  CURRENCIES,
  DOCUMENT_ID_RE,
  FREQUENCIES,
  PROGRAMME_IDS,
  PROGRAMME_SLUGS,
  SUPPORT_CATEGORIES,
  SUPPORT_FORM_CATEGORIES,
  type Currency,
} from "@/lib/model/enums";
import { normaliseRef } from "@/lib/model/refs";

const MSG = {
  required: "Please fill this in.",
  text: "Please enter text here.",
  choose: "Please choose one of the options.",
  email: "Please enter a valid email address, like name@example.com.",
  phone: "Please enter a phone number using digits, spaces and an optional + at the start.",
  consent: "Please tick this box to continue.",
  country: "Please choose a country.",
  reference: "That doesn't look like a Haven reference. It starts with HVN.",
  amount: "Please enter an amount.",
} as const;

/** NFC, CRLF → LF, control characters removed (tabs become spaces), single-line text flattened, trimmed. */
export function cleanText(value: string, multiline = false): string {
  let v = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, " ");
  v = v.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "");
  if (!multiline) v = v.replace(/\s*\n\s*/g, " ");
  else v = v.replace(/\n{3,}/g, "\n\n");
  return v.trim();
}

/**
 * A cleaned, capped string. `min: 1` makes it required ("Please fill this in."); larger minimums
 * read "Please write at least N characters."
 */
export const str = (max: number, opts: { min?: number; multiline?: boolean } = {}): z.ZodString => {
  let s = z
    .string({ error: (iss) => (iss.input === undefined || iss.input === null ? MSG.required : MSG.text) })
    .overwrite((v) => cleanText(v, opts.multiline))
    .max(max, { error: `Please keep this to ${max.toLocaleString("en")} characters or fewer.` });
  if (opts.min && opts.min > 0) {
    s = s.min(opts.min, { error: opts.min === 1 ? MSG.required : `Please write at least ${opts.min.toLocaleString("en")} characters.` });
  }
  return s;
};

/** Optional text: empty, missing or null becomes null. */
export function optionalStr(max: number, opts: { multiline?: boolean } = {}): z.ZodType<string | null> {
  // A missing key (a disabled or absent field) must read as empty, not "expected nonoptional" (zod 4).
  return z
    .preprocess((v) => (v === undefined ? null : v), z.union([z.string(), z.null()]))
    .transform((v) => (typeof v === "string" ? cleanText(v, opts.multiline) : ""))
    .pipe(z.string().max(max, { error: `Please keep this to ${max.toLocaleString("en")} characters or fewer.` }))
    .transform((v) => (v ? v : null));
}

/** Email as typed (trimmed). Store `emailLowerOf(email)` alongside it for search and hashing. */
export const emailSchema = z
  .string({ error: MSG.required })
  .trim()
  .min(1, { error: MSG.required })
  .max(254, { error: MSG.email })
  .pipe(z.email({ error: MSG.email }));

export function emailLowerOf(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose international phone number; spaces are removed. */
export const phoneSchema = z
  .string({ error: MSG.required })
  .trim()
  .regex(/^\+?[0-9 ()-]{6,24}$/, { error: MSG.phone })
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 6 && digits <= 20;
  }, { error: MSG.phone })
  .transform((v) => v.replace(/\s+/g, ""));

/** A ticked consent checkbox (FormData sends "on"). The server turns it into a ConsentStamp. */
export const consentSchema = z.literal("on", { error: MSG.consent });

/** An optional checkbox: "on"/"true"/"1" → true; anything else (or missing) → false. */
// An unticked box is simply absent from FormData. zod 4 rejects a missing key for a union that
// includes undefined ("expected nonoptional"), so map undefined to null before the union.
export const checkboxSchema = z.preprocess(
  (v) => (v === undefined ? null : v),
  z.union([z.string(), z.boolean(), z.null()]).transform((v) => v === true || v === "on" || v === "true" || v === "1"),
);

/** A Haven reference in any spoken or typed form, normalised (HVN-SR-2026-0012, HVN-K7Q2-M9XD…). */
export const refSchema = z
  .string({ error: MSG.reference })
  .trim()
  .max(40, { error: MSG.reference })
  .refine((v) => normaliseRef(v) !== null, { error: MSG.reference })
  .transform((v) => normaliseRef(v) as string);

/** A storage document id (PLAN D29). */
export const idSchema = z.string().regex(DOCUMENT_ID_RE, { error: "That id is not valid." });

/** A lowercase URL slug: words of letters and digits joined by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(1, { error: MSG.required })
  .max(80, { error: "Please keep the web address to 80 characters or fewer." })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and single hyphens only." });

/** Client-generated idempotency id for a submission. */
export const submissionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, { error: "Please refresh the page and try again." });

/** An https link (staff-entered websites, Zoom links, partner sites). */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(500, { error: "Please keep the link to 500 characters or fewer." })
  .pipe(z.url({ protocol: /^https$/, error: "Please enter a full link starting with https://" }));

/** ISO 3166-1 alpha-2 from lib/countries.ts (any case, stored lowercase), or "other" (PLAN D73). */
export const countrySchema = z
  .string({ error: MSG.country })
  .trim()
  .toLowerCase()
  .refine((v) => v === "other" || isIsoCountry(v), { error: MSG.country });

const PLACE_CODES = new Set(spriteCountries.map((c) => c.code));
/** content/world.ts codes: content `place` fields only (presence countries plus the US office). */
export const placeSchema = z
  .string({ error: MSG.country })
  .trim()
  .toLowerCase()
  .refine((v) => PLACE_CODES.has(v), { error: "Please choose one of the countries where Haven works." });

/** Haven's presence countries (no extras), for content that must name a programme country. */
export const PRESENCE_CODES: readonly string[] = worldCountries.map((c) => c.code);

export const currencySchema = z.enum(CURRENCIES, { error: "Please choose a currency." });
export const frequencySchema = z.enum(FREQUENCIES, { error: "Please choose how often to give." });
export const programmeIdSchema = z.enum(PROGRAMME_IDS, { error: MSG.choose });
export const programmeSlugSchema = z.enum(PROGRAMME_SLUGS, { error: MSG.choose });
export const ageBandSchema = z.enum(AGE_BANDS, { error: "Please choose an age range." });
export const contactMethodSchema = z.enum(CONTACT_METHODS, { error: "Please choose how we should contact you." });
export const supportCategorySchema = z.enum(SUPPORT_CATEGORIES, { error: "Please choose the type of support." });
export const supportFormCategorySchema = z.enum(SUPPORT_FORM_CATEGORIES, { error: "Please choose the type of support." });

/**
 * An amount in major units for a currency: positive, at most two decimal places (all four Haven
 * currencies have 100 minor units), and below a sanity cap. Online limits (maxOnline) are checked
 * by the server against settings.
 */
export const moneyMajorSchema = (c: Currency): z.ZodNumber =>
  z
    .number({ error: MSG.amount })
    .positive({ error: `Please enter an amount in ${c} greater than zero.` })
    .max(100_000_000, { error: `That amount in ${c} is too large for this form.` })
    .multipleOf(0.01, { error: "Please use at most two decimal places." });

/** A whole number from a form field ("12" → 12), within bounds. */
export const formInt = (min: number, max: number) =>
  z.coerce
    .number({ error: "Please enter a number." })
    .int({ error: "Please enter a whole number." })
    .min(min, { error: `Please enter ${min} or more.` })
    .max(max, { error: `Please enter ${max} or less.` });
