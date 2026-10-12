// The partnership enquiry (/get-involved/partner; public-pages §3.18, data-model §4.4). Isomorphic.
// Field names map onto the PartnershipEnquiry record (lib/model/domain/engagement.ts):
//   orgName, orgKind, website, country → organisation; contactName, role, email, phone → contact;
//   partnershipType; programme → programmeId; message; heardFrom; consent → consentToContact.

import { z } from "zod";
import { HEARD_FROM, PARTNER_KINDS, PARTNERSHIP_TYPES, PROGRAMME_IDS } from "@/lib/model/enums";
import { consentSchema, countrySchema, emailSchema, httpsUrlSchema, optionalStr, phoneSchema, str } from "@/lib/schemas/common";

export const PARTNER_MESSAGE_MIN = 50;
export const PARTNER_MESSAGE_MAX = 2000;

const MSG = {
  kind: "Please choose the kind of organisation.",
  type: "Please choose how you would like to partner with us.",
} as const;

const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .preprocess((v) => (v === undefined ? null : v), z.union([z.literal(""), z.enum(values), z.null()]))
    .transform((v) => (v ? (v as T[number]) : null));

/** Optional website: empty becomes null; a bare domain gets https:// added before validation. */
const optionalWebsite = z
  .preprocess((v) => (v === undefined ? null : v), z.union([z.string(), z.null()]))
  .transform((v) => {
    const t = typeof v === "string" ? v.trim() : "";
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, "https://") : `https://${t}`;
  })
  .pipe(z.union([z.literal(""), httpsUrlSchema]))
  .transform((v) => (v === "" ? null : v));

/** Optional phone: empty or missing becomes null. */
const optionalPhone = z
  .preprocess((v) => (v === undefined ? null : v), z.union([z.string(), z.null()]))
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.union([z.literal(""), phoneSchema]))
  .transform((v) => (v === "" ? null : v));

export const partnershipSchema = z.object({
  orgName: str(120, { min: 2 }),
  orgKind: z.enum(PARTNER_KINDS, { error: MSG.kind }),
  website: optionalWebsite,
  country: countrySchema,
  contactName: str(100, { min: 2 }),
  role: optionalStr(80),
  email: emailSchema,
  phone: optionalPhone,
  partnershipType: z.enum(PARTNERSHIP_TYPES, { error: MSG.type }),
  programme: optionalEnum(PROGRAMME_IDS),
  message: str(PARTNER_MESSAGE_MAX, { min: PARTNER_MESSAGE_MIN, multiline: true }),
  heardFrom: optionalEnum(HEARD_FROM),
  consent: consentSchema,
});

export type PartnershipInput = z.input<typeof partnershipSchema>;
export type PartnershipData = z.output<typeof partnershipSchema>;
export type PartnershipField = keyof PartnershipInput;

export const PARTNERSHIP_FIELD_ORDER: PartnershipField[] = [
  "orgName",
  "orgKind",
  "website",
  "country",
  "contactName",
  "role",
  "email",
  "phone",
  "partnershipType",
  "programme",
  "message",
  "heardFrom",
  "consent",
];

export const PARTNERSHIP_ECHO_KEYS: PartnershipField[] = PARTNERSHIP_FIELD_ORDER.filter((k) => k !== "consent");

/** One-line descriptions for the partnership type cards (public-pages §3.18 [draft]). */
export const PARTNERSHIP_TYPE_HELP: Record<(typeof PARTNERSHIP_TYPES)[number], string> = {
  programme: "Co-deliver or fund one of our six programmes.",
  corporate_sponsorship: "Sponsor a programme, an appeal or an event as a business.",
  technical_assistance: "Lend expertise: medical, legal, IT, finance or training.",
  institutional_referral: "You run a children's home, school or charity and need support, or refer children to us.",
  research_collaboration: "Study what works for children and families, with consent and care.",
  donation_partnership: "Give regularly, match staff giving or donate goods in kind.",
  awareness_campaign: "Help us reach more families and supporters.",
  other: "Something else? Tell us your idea.",
};
