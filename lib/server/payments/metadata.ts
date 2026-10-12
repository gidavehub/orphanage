import "server-only";

// The versioned `haven_*` metadata contract on every Checkout Session, PaymentIntent and Subscription
// (integrations §3.3, PLAN D37). No names, emails, phones or comments ever go into Stripe metadata.

import { z } from "zod";
import { FREQUENCIES } from "@/lib/model/enums";

export const HavenMeta = z.object({
  haven_v: z.literal("1"),
  /** donationIntents id (new gifts). */
  haven_intent: z.string().max(64).optional(),
  /** Existing pledged Donation (pay-later card link). */
  haven_donation_ref: z.string().max(40).optional(),
  haven_kind: z.enum(["one_time", "recurring"]),
  haven_frequency: z.enum(FREQUENCIES),
  /** targetKey(): "general" | "programme:education" | "cause:eid-clothes-gifts". */
  haven_target: z.string().min(1).max(120),
  /** The cause page the donor gave from (attribution). */
  haven_cause: z.string().min(1).max(80),
  /** "HVN-SP-0012". */
  haven_sponsor_ref: z.string().max(20).optional(),
  haven_cover_fees: z.enum(["0", "1"]),
  /** The amount before cover fees, in minor units. */
  haven_base_minor: z.string().regex(/^\d+$/),
});

export type HavenMeta = z.infer<typeof HavenMeta>;

/** Parses Stripe metadata (string map) into the contract, or null when it isn't one of ours. */
export function parseHavenMeta(metadata: Record<string, string> | null | undefined): HavenMeta | null {
  if (!metadata) return null;
  const parsed = HavenMeta.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
