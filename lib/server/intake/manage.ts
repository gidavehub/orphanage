import "server-only";

// "Manage your regular gift" (integrations §3.7; PLAN D70): a donor asks for a magic link at
// /donate/manage. Honeypot, time trap, 3 per hour per IP hash and 3 per day per address. When the
// address has a card regular gift, `donor_manage_link` carries a 60-minute portal link. The answer is
// ALWAYS the same, so the form never confirms whether an address is known.

import { z } from "zod";
import type { FormState } from "@/lib/forms/types";
import { emailSchema } from "@/lib/schemas/common";
import { enqueueEmail } from "@/lib/server/email/outbox";
import { features } from "@/lib/server/env";
import { donorIdOf } from "@/lib/server/giving/donors";
import { log } from "@/lib/server/log";
import { portalLink, stripeGiftsOf } from "@/lib/server/payments/portal";
import { emailHash } from "@/lib/server/security/hmac";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { runIntake } from "./pipeline";

export const MANAGE_LINK_ANSWER = "If you have a regular gift with us, we’ve emailed you a link to manage it. It works for 60 minutes.";

const Schema = z.object({ email: emailSchema });

export async function submitManageLinkForm(fd: FormData): Promise<FormState> {
  return runIntake({
    form: "manage_link",
    input: fd,
    schema: Schema,
    echoKeys: ["email"],
    rateLimitedMessage: "You’ve asked for several links in a short time. Please wait an hour and try again, or email our donations team.",
    fakeSuccess: () => ({ status: "success", message: MANAGE_LINK_ANSWER }),
    create: async (d, ctx) => {
      const email = d.email.trim();
      const perAddress = await rateLimit("manage_link_address", emailHash(email), ctx.now).catch(() => ({ ok: true }) as { ok: boolean });
      if (perAddress.ok && features.stripe) {
        try {
          const donorId = donorIdOf(email);
          const gifts = await stripeGiftsOf(donorId);
          if (gifts.length) {
            await enqueueEmail({ template: "donor_manage_link", to: [email], vars: { link: portalLink(donorId) }, dedupeKey: `${donorId.slice(0, 24)}~${Math.floor(ctx.now / 600_000)}` });
          }
        } catch (err) {
          log.warn("manage_link.failed", { err });
        }
      }
      return { message: MANAGE_LINK_ANSWER };
    },
  });
}
