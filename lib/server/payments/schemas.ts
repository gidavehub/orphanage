import "server-only";

// POST /api/donations contract (public-pages §4.4/§4.7 with PLAN D64–D67, D71, D81).
// One endpoint for cash and in-kind, Stripe and pledge. Frequency is `one_time` here (the URL may
// say `once`; lib/routes.ts maps it). Online maximums and per-currency minimums are checked by the
// route against settings/payment and donate.config, not here.

import { z } from "zod";
import { countrySchema, emailSchema, phoneSchema, str, submissionIdSchema } from "@/lib/schemas/common";
import type { Attribution } from "@/lib/model/domain/giving";
import { CURRENCIES, FREQUENCIES, IN_KIND_CATEGORIES, IN_KIND_CONDITIONS, LOCAL_PAYMENT_METHODS } from "@/lib/model/enums";
import { SPONSOR_RE, normaliseRef } from "@/lib/model/refs";
import { HONEYPOT_FIELD } from "@/lib/forms/spam";

export type { Attribution } from "@/lib/model/domain/giving";

/** Empty strings and nulls from JSON become "not provided". */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());
}

const causeSlugSchema = z
  .string({ error: "Please choose a cause." })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Please choose a cause." })
  .max(80);

const sponsorRefSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v) => normaliseRef(v) ?? v)
  .refine((v) => SPONSOR_RE.test(v), { error: "That sponsorship reference isn't valid." });

const amountSchema = z
  .number({ error: "Please enter an amount." })
  .positive({ error: "Please enter an amount greater than zero." })
  .max(100_000_000, { error: "That amount is too large for this form." })
  .multipleOf(0.01, { error: "Please use at most two decimal places." });

export const AttributionSchema = z.object({
  utmSource: optional(z.string().trim().max(200)),
  utmMedium: optional(z.string().trim().max(200)),
  utmCampaign: optional(z.string().trim().max(200)),
  referrer: optional(z.string().trim().max(500)),
});

export const DonorInputSchema = z
  .object({
    fullName: str(120, { min: 1 }),
    email: emailSchema,
    phone: optional(phoneSchema),
    country: countrySchema,
    type: z.enum(["individual", "organisation"], { error: "Please choose individual or organisation." }),
    organisation: optional(str(150)),
    anonymous: z.boolean().default(false),
    comments: optional(str(500, { multiline: true })),
    updates: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.type === "organisation" && !d.organisation) {
      ctx.addIssue({ code: "custom", path: ["organisation"], message: "Please add the organisation's name." });
    }
  });

const common = {
  submissionId: submissionIdSchema,
  cause: causeSlugSchema,
  donor: DonorInputSchema,
  attribution: optional(AttributionSchema),
  /** Honeypot: any value means a bot (fake success, nothing stored). */
  [HONEYPOT_FIELD]: optional(z.string().max(500)),
  /** Milliseconds from first render to submit (time trap). */
  _elapsed: z.number({ error: "Please refresh the page and try again." }).int().nonnegative(),
};

export const CashDonationSchema = z.object({
  mode: z.literal("cash"),
  ...common,
  /** Sponsorship profile code (only with the sponsor-a-child cause; the route checks). */
  ref: optional(sponsorRefSchema),
  currency: z.enum(CURRENCIES, { error: "Please choose a currency." }),
  /** Major units, before cover fees. */
  amount: amountSchema,
  frequency: z.enum(FREQUENCIES, { error: "Please choose how often to give." }),
  coverFees: z.boolean().default(false),
  /** The pledge-route method the donor picked, when not paying by card. */
  method: optional(z.enum(LOCAL_PAYMENT_METHODS)),
});

export const InKindDonationSchema = z.object({
  mode: z.literal("in_kind"),
  ...common,
  items: z.array(z.enum(IN_KIND_CATEGORIES)).min(1, { error: "Please choose at least one kind of item." }).max(IN_KIND_CATEGORIES.length),
  description: str(1000, { min: 20, multiline: true }),
  condition: z.enum(IN_KIND_CONDITIONS, { error: "Please choose the condition." }),
  estValue: optional(z.object({ amount: amountSchema, currency: z.enum(CURRENCIES) })),
  handover: z.enum(["drop_off", "collection", "shipping"], { error: "Please choose how the items will reach us." }),
  /** Town or city. */
  location: str(80, { min: 1 }),
});

export const DonationRequestSchema = z.discriminatedUnion("mode", [CashDonationSchema, InKindDonationSchema]);

export type DonorInput = z.output<typeof DonorInputSchema>;
export type CashDonationRequest = z.output<typeof CashDonationSchema>;
export type InKindDonationRequest = z.output<typeof InKindDonationSchema>;
export type DonationRequest = z.output<typeof DonationRequestSchema>;
/** What the donate widget sends (JSON). */
export type DonationRequestInput = z.input<typeof DonationRequestSchema>;

/** The response of POST /api/donations (D66). */
export type DonationResponse =
  | { kind: "stripe"; url: string }
  /** "/donate/thank-you?ref=HVN-DN-…&t=…" */
  | { kind: "pledge"; next: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

// Compile-time check: the zod attribution shape matches the stored Attribution type.
type AssertAttribution = z.output<typeof AttributionSchema> extends Attribution ? true : never;
const attributionMatches: AssertAttribution = true;
void attributionMatches;
