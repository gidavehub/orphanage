// Newsletter sign-up (landing JoinSphere, footer and other placements; PLAN D103 double opt-in,
// data-model §4.4). Isomorphic. The subscriber stays `pending` until the emailed link is followed.

import { z } from "zod";
import { emailSchema, optionalStr } from "@/lib/schemas/common";

export const NEWSLETTER_SOURCES = ["footer", "join_section", "donation", "volunteer", "post"] as const;

export const newsletterSchema = z.object({
  email: emailSchema,
  firstName: optionalStr(60),
  source: z
    .preprocess((v) => (v === undefined ? null : v), z.union([z.enum(NEWSLETTER_SOURCES), z.literal(""), z.null()]))
    .transform((v) => (v ? v : "join_section")),
});

export type NewsletterInput = z.input<typeof newsletterSchema>;
export type NewsletterData = z.output<typeof newsletterSchema>;
export type NewsletterField = keyof NewsletterInput;
