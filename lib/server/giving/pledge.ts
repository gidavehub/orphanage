import "server-only";

// Pledges (integrations §3.11, public-pages §4.7–4.8, PLAN D65–D67, D71): the local route for cash
// gifts (bank transfer, mobile money, or "email me a card link") and every in-kind offer. One
// transaction writes the `pledged` Donation (HVN-DN-YYYY-NNNN), upserts the donor by emailHash, adds
// the timeline event, queues `pledge_instructions` or `inkind_follow_up` in the Outbox and notifies
// finance. A completed marker in donationIntents/{intentId} makes a double submit return the same
// reference instead of a second pledge. The thank-you link carries a signed `t` (7 days).

import type { DonationIntent } from "@/lib/model/domain/giving";
import type { Currency, InKindCategory, LocalPaymentMethod, Money, ProgrammeId } from "@/lib/model/enums";
import { FREQUENCY_LABEL, HANDOVER_LABEL } from "@/lib/model/labels";
import { adminHrefOfRef } from "@/lib/model/refs";
import { formatMoney, toMinor, withCoverFees } from "@/lib/money";
import { routes } from "@/lib/routes";
import { getStore } from "@/lib/server/db";
import { auditTx } from "@/lib/server/audit";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { consentStamp } from "@/lib/server/intake/pipeline";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import type { CashDonationRequest, InKindDonationRequest } from "@/lib/server/payments/schemas";
import { allocateReference } from "@/lib/server/references";
import { signTokenFor } from "@/lib/server/security/hmac";
import { donorIdOf, donorSnapshotOf, readDonorTx, upsertDonorTx } from "./donors";
import { buildDonation, donationPath, paymentMethodOf, preferredTargetOf } from "./ledger";
import { intentIdFrom, intentPath } from "./intents";
import { getCauses, getContact, getDonateConfig, getPaymentSettings } from "@/lib/content/public";
import type { CauseView } from "@/lib/content/types";
import { countryName } from "@/lib/countries";
import { CURRENCIES } from "@/lib/model/enums";
import { LOCAL_PAYMENT_METHOD_LABEL } from "@/lib/model/labels";
import { env, features, resolveBackend } from "@/lib/server/env";
import { effectiveRoutes } from "@/lib/server/payments/routing";
import { categoryOfLabel, type GivingConfig, type WidgetCause } from "@/components/donate/model";

const THANKS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MARKER_TTL_MS = 48 * 60 * 60 * 1000;

/** The cause a gift is for, as the route resolved it (closed causes already fall back to general). */
export type PledgeCause = { slug: string; title: string; kind: string; programmeId?: ProgrammeId };

export type PledgeResult = { reference: string; next: string; deduped: boolean };

/** "/donate/thank-you?ref=HVN-DN-…&t=…" (the token proves the link came from us; 7 days). */
export function thankYouHref(reference: string): string {
  return routes.thankYou({ ref: reference, t: signTokenFor("thanks", reference, THANKS_TTL_MS) });
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
}

/** Cash: major units and cover fees → the charged and base amounts in minor units. */
export function cashAmounts(currency: Currency, amountMajor: number, coverFees: boolean, coverFeesPercent: number): { amount: Money; baseAmount: Money } {
  const baseMinor = toMinor(amountMajor, currency);
  return {
    baseAmount: { amountMinor: baseMinor, currency },
    amount: { amountMinor: withCoverFees(baseMinor, coverFees, coverFeesPercent), currency },
  };
}

type Common = { cause: PledgeCause; sponsorRef: string | null; baseUrl: string };

export type CashPledgeInput = Common & {
  kind: "cash";
  request: CashDonationRequest;
  coverFeesPercent: number;
  /** The method chip the donor picked (or the currency's first method). */
  localMethod: LocalPaymentMethod | null;
};

export type InKindPledgeInput = Common & {
  kind: "in_kind";
  request: InKindDonationRequest;
  categories: InKindCategory[];
};

/** Records a pledge or an in-kind offer and returns its reference and the thank-you link. */
export async function recordPledge(input: CashPledgeInput | InKindPledgeInput): Promise<PledgeResult> {
  const req = input.request;
  const snapshot = donorSnapshotOf(req.donor);
  const donorId = donorIdOf(snapshot.email);
  const firstName = firstNameOf(snapshot.fullName);
  const cash = input.kind === "cash";
  // Resolve staff recipients before the transaction (notify routes read settings and staff).
  const recipients = await recipientsFor(cash ? "donation_new" : "inkind_new");
  const markerPath = intentPath(intentIdFrom(req.submissionId));

  const result = await getStore().runTransaction(async (tx) => {
    const now = Date.now();
    // Reads first.
    const marker = await tx.get<DonationIntent>(markerPath);
    if (marker?.donationRef) return { reference: marker.donationRef, deduped: true };
    const existingDonor = await readDonorTx(tx, donorId);

    const reference = await allocateReference(tx, "donations", { now });
    const path = donationPath(reference);
    const updatesConsent = req.donor.updates ? consentStamp(now) : null;
    const recognition = req.donor.anonymous ? "anonymous" : "named";
    const preferredTarget = preferredTargetOf(input.cause);

    let amountLine = "";
    if (input.kind === "cash") {
      const r = input.request;
      const { amount, baseAmount } = cashAmounts(r.currency, r.amount, r.coverFees, input.coverFeesPercent);
      const { method, payLater } = paymentMethodOf(input.localMethod);
      amountLine = `${formatMoney(amount)} · ${FREQUENCY_LABEL[r.frequency]}`;
      tx.create(
        path,
        buildDonation(reference, now, {
          kind: "cash",
          status: "pledged",
          source: "web_form",
          donorId,
          donor: snapshot,
          recognition,
          frequency: r.frequency,
          preferredTarget,
          causeSlug: input.cause.slug,
          sponsorRef: input.sponsorRef,
          comments: req.donor.comments ?? null,
          updatesConsent,
          attribution: req.attribution ?? null,
          cash: { amount, baseAmount, coverFees: r.coverFees, method, localMethod: input.localMethod, ...(payLater ? { payLater } : {}) },
        }),
      );
      // The intent marker: a double submit finds this and returns the same reference.
      tx.set<DonationIntent>(markerPath, {
        createdAt: now,
        expireAt: now + MARKER_TTL_MS,
        submissionId: r.submissionId,
        amount,
        baseAmount,
        coverFees: r.coverFees,
        frequency: r.frequency,
        preferredTarget,
        causeSlug: input.cause.slug,
        sponsorRef: input.sponsorRef,
        donor: snapshot,
        recognition,
        comments: req.donor.comments ?? null,
        updatesConsent,
        attribution: req.attribution ?? null,
        checkoutSessionId: "",
        status: "completed",
        donationRef: reference,
        recurringGiftRef: null,
      });
    } else {
      const r = input.request;
      const estimatedValue = r.estValue ? { amountMinor: toMinor(r.estValue.amount, r.estValue.currency), currency: r.estValue.currency } : null;
      tx.create(
        path,
        buildDonation(reference, now, {
          kind: "in_kind",
          status: "pledged",
          source: "web_form",
          donorId,
          donor: snapshot,
          recognition,
          frequency: "one_time",
          preferredTarget,
          causeSlug: input.cause.slug,
          sponsorRef: null,
          comments: req.donor.comments ?? null,
          updatesConsent,
          attribution: req.attribution ?? null,
          inKind: {
            categories: input.categories,
            description: r.description,
            estimatedValue,
            condition: r.condition,
            delivery: r.handover,
            locality: r.location,
          },
        }),
      );
      tx.set<DonationIntent>(markerPath, {
        createdAt: now,
        expireAt: now + MARKER_TTL_MS,
        submissionId: r.submissionId,
        amount: estimatedValue ?? { amountMinor: 0, currency: "USD" },
        baseAmount: estimatedValue ?? { amountMinor: 0, currency: "USD" },
        coverFees: false,
        frequency: "one_time",
        preferredTarget,
        causeSlug: input.cause.slug,
        sponsorRef: null,
        donor: snapshot,
        recognition,
        comments: req.donor.comments ?? null,
        updatesConsent,
        attribution: req.attribution ?? null,
        checkoutSessionId: "",
        status: "completed",
        donationRef: reference,
        recurringGiftRef: null,
      });
    }

    upsertDonorTx(tx, existingDonor, { donorId, snapshot, recognition, updatesConsent, now });

    addEventTx(tx, path, {
      type: "created",
      actor: { kind: "public" },
      summary: cash ? "Gift pledged through the website" : "Items offered through the website",
      at: now,
    });

    const thanksPath = thankYouHref(reference);
    const link = `${input.baseUrl}${thanksPath}`;
    if (input.kind === "cash") {
      await enqueueEmailTx(tx, {
        template: "pledge_instructions",
        to: [snapshot.email],
        vars: { reference, firstName, amount: amountLine, cause: input.cause.title, instructionsUrl: link },
        related: { path, reference },
      });
    } else {
      await enqueueEmailTx(tx, {
        template: "inkind_follow_up",
        to: [snapshot.email],
        vars: { reference, firstName, cause: input.cause.title, handover: HANDOVER_LABEL[input.request.handover], detailsUrl: link },
        related: { path, reference },
      });
    }
    addEventTx(tx, path, {
      type: "email_queued",
      actor: { kind: "system", job: "intake" },
      summary: cash ? "Payment instructions email queued" : "In-kind thank-you email queued",
      at: now,
    });

    if (recipients.length) {
      notifyTx(tx, {
        recipientUids: recipients,
        kind: "new_case",
        title: cash ? `New pledge ${reference}` : `New in-kind offer ${reference}`,
        href: adminHrefOfRef(reference, cash ? "gift" : "inkind"),
      });
    }

    auditTx(tx, {
      actor: { kind: "public" },
      action: cash ? "donation.pledge" : "donation.inkind_offer",
      area: "donations",
      summary: cash ? `A gift was pledged on the website (${reference})` : `Items were offered on the website (${reference})`,
      feed: true,
      targetPath: path,
      targetRef: reference,
    });

    return { reference, deduped: false };
  });

  return { reference: result.reference, next: thankYouHref(result.reference), deduped: result.deduped };
}

/* ── What the donate widget may offer (public-pages §4.4, §4.8) ───────── */
// Display config from donate.config, payment routing from settings/payment + env (never NEXT_PUBLIC_),
// causes from the cached content readers. Plain and serialisable: it crosses to the client widget on
// /donate (the (give) layout) and on the landing (app/(site)/page.tsx → <Donate giving={…} />).

export function toWidgetCause(c: CauseView): WidgetCause {
  const items = [...new Set(c.inKindItems.map(categoryOfLabel))];
  return {
    slug: c.slug,
    kind: c.kind,
    title: c.title,
    ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}),
    season: c.season,
    groupId: c.groupId,
    summary: c.summary,
    image: {
      src: c.image.src,
      alt: c.image.alt,
      ...(c.image.blurDataURL ? { blurDataURL: c.image.blurDataURL } : {}),
      ...(c.image.focal ? { focal: c.image.focal } : {}),
      ...(c.image.illustrative ? { illustrative: true } : {}),
      ...(c.image.decorative ? { decorative: true } : {}),
    },
    ...(c.place ? { place: { code: c.place, name: countryName(c.place) } } : {}),
    tone: c.tone,
    currency: c.currency,
    goal: c.goal,
    raised: c.raised,
    percent: c.percent,
    showFigures: c.showFigures,
    verified: c.verified,
    allocation: c.allocation.map((p) => ({ label: p.label, percent: p.percent, ...(p.tone ? { tone: p.tone } : {}), ...(p.note ? { note: p.note } : {}) })),
    ...(c.allocationAsOf ? { allocationAsOf: c.allocationAsOf } : {}),
    impactUnits: c.impactUnits.map((u) => ({ amount: u.amount, currency: u.currency, label: u.label })),
    presetAmounts: c.presetAmounts,
    defaultFrequency: c.defaultFrequency,
    allowedFrequencies: c.allowedFrequencies.length ? c.allowedFrequencies : ["one_time"],
    inKindItems: items,
    zakatEligible: c.zakatEligible,
    live: c.live,
    closed: c.closed,
    href: c.href,
    ...(c.programmeSlug ? { programmeSlug: c.programmeSlug } : {}),
  };
}

/** Everything the widget needs: display config, routes and limits, and every visible cause. */
export async function loadGiving(): Promise<{ config: GivingConfig; causes: WidgetCause[] }> {
  const [donate, payment, causes, contact] = await Promise.all([getDonateConfig(), getPaymentSettings(), getCauses({ liveOnly: false }), getContact()]);
  const routes = effectiveRoutes(payment);
  const methods: GivingConfig["methods"] = {};
  for (const c of CURRENCIES) {
    const list = payment.instructions[c]?.methods ?? [];
    // "Card: email me a link" only makes sense while the currency cannot be paid by card here.
    const usable = list.filter((m: LocalPaymentMethod) => !(m === "card_link" && routes[c] === "stripe"));
    if (usable.length) methods[c] = usable.map((id) => ({ id, label: LOCAL_PAYMENT_METHOD_LABEL[id] }));
  }
  const inKind: GivingConfig["inKind"] = [];
  for (const label of donate.inKind) {
    const value = categoryOfLabel(label);
    if (!inKind.some((i) => i.value === value)) inKind.push({ value, label });
  }
  const enabled = new Set<Currency>(donate.currencies.map((c) => c.code));
  return {
    config: {
      currencies: donate.currencies,
      defaultCurrency: enabled.has(donate.defaultCurrency) ? donate.defaultCurrency : (donate.currencies[0]?.code ?? "USD"),
      frequencies: donate.frequencies,
      inKind,
      routes,
      maxOnline: payment.maxOnline,
      coverFeesPercent: payment.coverFeesPercent,
      fx: payment.fx,
      methods,
      donationsEmail: contact.teamEmails.donations,
      pledgeBadge: !features.stripe && env.vercelEnv !== "production",
      unavailable: resolveBackend() === "unavailable",
    },
    causes: causes.map(toWidgetCause),
  };
}
