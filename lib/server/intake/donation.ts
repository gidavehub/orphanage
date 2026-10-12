import "server-only";

// The donate endpoint's intake (public-pages §4.4/§4.7, integrations §3.2–3.4/§3.11, PLAN D37–D40,
// D63–D67, D71). One entry for cash and in-kind, card and pledge:
//   runIntake (backend → honeypot + time trap → 10 per hour per IP hash → zod)
//   → cause check (unknown → field error; closed or not yet live → "where it's needed most")
//   → cash: currency enabled, minimum, allowed frequency, sponsorship code, method chip
//        → card route (key + STRIPE_CURRENCIES + settings route + ≤ maxOnline): intent first (D67),
//          then startCheckout; null (Stripe off or not built) → pledge, so no gift is ever lost
//        → local route: pledge with instructions
//   → in-kind: offer recorded as a pledge with a follow-up email.
// Bots get a generic thank-you link and nothing is stored.

import type { CauseView } from "@/lib/content/types";
import { formError, type FormState } from "@/lib/forms/types";
import type { InKindCategory, LocalPaymentMethod } from "@/lib/model/enums";
import { IN_KIND_CATEGORIES } from "@/lib/model/enums";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { money } from "@/lib/money";
import { routes } from "@/lib/routes";
import { getCause, getDonateConfig, getPaymentSettings, getSponsorProfiles } from "@/lib/content/public";
import { donorSnapshotOf } from "@/lib/server/giving/donors";
import { intentIdFrom, writeIntent } from "@/lib/server/giving/intents";
import { preferredTargetOf } from "@/lib/server/giving/ledger";
import { cashAmounts, recordPledge, type PledgeCause } from "@/lib/server/giving/pledge";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { log } from "@/lib/server/log";
import { startCheckout } from "@/lib/server/payments/checkout";
import { routeForGift } from "@/lib/server/payments/routing";
import {
  DonationRequestSchema,
  type CashDonationRequest,
  type DonationRequest,
  type DonationResponse,
  type InKindDonationRequest,
} from "@/lib/server/payments/schemas";
import { baseUrl } from "@/lib/server/url";

export const CHECKOUT_FAILED_MESSAGE =
  "We couldn't start the payment. Nothing has been charged. Please try again, or pledge now and pay later.";

const SPONSOR_CAUSE = "sponsor-a-child";

type Fail = { kind: "error"; message: string; fieldErrors?: Record<string, string> };

function fieldFail(field: string, message: string): Fail {
  return { kind: "error", message: "Please check the highlighted fields and try again.", fieldErrors: { [field]: message } };
}

/** Closed, paused or not-yet-started causes take gifts for "where it's needed most" instead. */
async function resolveCause(slug: string): Promise<{ view: CauseView; given: CauseView } | null> {
  const given = await getCause(slug);
  if (!given) return null;
  if (given.live || given.kind === "general") return { view: given, given };
  const general = await getCause("general");
  return general ? { view: general, given } : { view: given, given };
}

function pledgeCause(c: CauseView): PledgeCause {
  return { slug: c.slug, title: c.title, kind: c.kind, ...(c.programmeId ? { programmeId: c.programmeId } : {}) };
}

/** donate.config's in-kind labels and the offer's categories, matched case-insensitively. */
function categoriesOf(items: readonly InKindCategory[]): InKindCategory[] {
  const out = items.filter((i) => (IN_KIND_CATEGORIES as readonly string[]).includes(i));
  return out.length ? [...new Set(out)] : ["other"];
}

async function sponsorRefFor(cause: CauseView, ref: string | undefined): Promise<string | null> {
  if (!ref || (cause.slug !== SPONSOR_CAUSE && cause.kind !== "sponsorship")) return null;
  try {
    const profiles = await getSponsorProfiles();
    return profiles.some((p) => p.code === ref) ? ref : null;
  } catch {
    return null;
  }
}

async function handleCash(req: CashDonationRequest, request: Request, pledgeInstead: boolean): Promise<DonationResponse> {
  const resolved = await resolveCause(req.cause);
  if (!resolved) return fieldFail("cause", "Please choose a cause.");
  const cause = resolved.view;

  const config = await getDonateConfig();
  const cur = config.currencies.find((c) => c.code === req.currency);
  if (!cur) return fieldFail("currency", "Please choose one of the currencies shown.");
  if (req.amount < cur.min) return fieldFail("amount", `The smallest gift in ${cur.code} is ${money(cur.min, cur.code)}.`);
  if (!config.frequencies.some((f) => f.value === req.frequency)) return fieldFail("frequency", "Please choose how often to give.");
  if (!cause.allowedFrequencies.includes(req.frequency)) {
    const allowed = cause.allowedFrequencies.map((f) => FREQUENCY_LABEL[f].toLowerCase()).join(" or ");
    return fieldFail("frequency", `This cause takes ${allowed} gifts.`);
  }

  const payment = await getPaymentSettings();
  const methods = payment.instructions[req.currency]?.methods ?? [];
  const localMethod: LocalPaymentMethod | null = req.method && methods.includes(req.method) ? req.method : (methods[0] ?? null);
  const sponsorRef = await sponsorRefFor(cause, req.ref);
  const base = baseUrl(request);
  const route = routeForGift(payment, req.currency, req.amount);

  // "Pledge now and pay later" after a failed card start skips the card route for this submission.
  if (route === "stripe" && !pledgeInstead) {
    // D67: the intent is written before Stripe is called, so the donor's choices are never lost.
    const intentId = intentIdFrom(req.submissionId);
    try {
      const { amount, baseAmount } = cashAmounts(req.currency, req.amount, req.coverFees, payment.coverFeesPercent);
      const written = await writeIntent(intentId, {
        submissionId: req.submissionId,
        amount,
        baseAmount,
        coverFees: req.coverFees,
        frequency: req.frequency,
        preferredTarget: preferredTargetOf(cause),
        causeSlug: cause.slug,
        sponsorRef,
        donor: donorSnapshotOf(req.donor),
        recognition: req.donor.anonymous ? "anonymous" : "named",
        comments: req.donor.comments ?? null,
        updatesConsent: req.donor.updates ? consentStamp() : null,
        attribution: req.attribution ?? null,
      });
      if (written.completed) return { kind: "pledge", next: routes.thankYou({}) };
      const checkout = await startCheckout(
        { ...req, cause: cause.slug, ref: sponsorRef ?? undefined },
        { intentId, baseUrl: base, cause: { slug: cause.slug, title: cause.title }, amount, baseAmount, target: preferredTargetOf(cause), sponsorRef },
      );
      if (checkout) return { kind: "stripe", url: checkout.url };
    } catch (err) {
      log.error("donation.checkout_failed", { err });
      return { kind: "error", message: CHECKOUT_FAILED_MESSAGE };
    }
  }

  const pledge = await recordPledge({
    kind: "cash",
    request: req,
    cause: pledgeCause(cause),
    sponsorRef,
    baseUrl: base,
    coverFeesPercent: payment.coverFeesPercent,
    localMethod,
  });
  return { kind: "pledge", next: pledge.next };
}

async function handleInKind(req: InKindDonationRequest, request: Request): Promise<DonationResponse> {
  const resolved = await resolveCause(req.cause);
  if (!resolved) return fieldFail("cause", "Please choose a cause.");
  const pledge = await recordPledge({
    kind: "in_kind",
    request: req,
    cause: pledgeCause(resolved.view),
    sponsorRef: null,
    baseUrl: baseUrl(request),
    categories: categoriesOf(req.items),
  });
  return { kind: "pledge", next: pledge.next };
}

function toResponse(state: FormState<string, DonationResponse>): { body: DonationResponse; status: number } {
  if (state.status === "success") {
    // Bots get a generic thank-you (nothing was stored).
    return { body: state.data ?? { kind: "pledge", next: routes.thankYou({}) }, status: 200 };
  }
  if (state.status === "error") {
    switch (state.code) {
      case "validation":
        return { body: { kind: "error", message: state.message, ...(state.fieldErrors ? { fieldErrors: state.fieldErrors as Record<string, string> } : {}) }, status: 422 };
      case "rate_limited":
        return { body: { kind: "error", message: state.message }, status: 429 };
      case "unavailable":
      case "closed":
        return { body: { kind: "unavailable", message: state.message }, status: 503 };
      default:
        return { body: { kind: "error", message: state.message }, status: 500 };
    }
  }
  return { body: { kind: "error", message: "Something went wrong. Please try again." }, status: 500 };
}

/** POST /api/donations body → response (the route handler only adds the HTTP envelope). */
export async function submitDonation(body: unknown, request: Request): Promise<{ body: DonationResponse; status: number }> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return toResponse(formError("validation", "Please refresh the page and try again.") as FormState<string, DonationResponse>);
  }
  // Read before zod strips it: the widget's "pledge now and pay later" link after a card failure.
  const pledgeInstead = (body as Record<string, unknown>).pledgeInstead === true;
  const state = await runIntake<typeof DonationRequestSchema, DonationResponse>({
    form: "donation",
    input: body as Record<string, unknown>,
    schema: DonationRequestSchema,
    request,
    rateLimitedMessage: "You've tried to give several times in a short while. Please wait a little and try again, or email our donations team.",
    create: async (data: DonationRequest) => {
      const res = data.mode === "cash" ? await handleCash(data, request, pledgeInstead) : await handleInKind(data, request);
      return { data: res };
    },
  });
  const out = toResponse(state);
  // A business-rule failure inside create still answers 422 with its field errors.
  if (out.body.kind === "error" && out.status === 200) out.status = out.body.fieldErrors ? 422 : 502;
  return out;
}

