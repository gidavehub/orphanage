import "server-only";

// Report requests (admin-ux §6.8; PLAN D59, D112). Edges come from FLOWS. Approving issues a 7-day
// delivery: a random tokenId on the record and an HMAC "delivery" token in the email's /r/<token>
// link (the route checks both, so a link can be revoked). Resending issues a fresh link; revoking
// stops the current one. Declining sends the kind decline email. An unlisted request (D59) is
// approved by choosing which library item to send.

import { randomBytes } from "node:crypto";
import type { ReportRequest, Resource } from "@/lib/model/domain/library";
import type { Millis } from "@/lib/model/enums";
import { docPath } from "@/lib/server/db/collections";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { firstNameOf } from "@/lib/server/intake/caseBase";
import { signToken } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import { defineMachine, type TransitionInput } from "./flow";

export type ReportRequestInput = TransitionInput & {
  /** approve: the library item to send (required for unlisted requests). */
  resourceId?: string;
  /** decline: an optional kind note. */
  note?: string;
  /** Set by the approve/resend patch for its effect (reads in a transaction can't see its own writes). */
  _delivery?: Delivery;
};

type Delivery = NonNullable<ReportRequest["delivery"]>;

export const DELIVERY_TTL_MS = 7 * 86_400_000;

/** The /r/ link for a delivery (deterministic: the same tokenId and expiry give the same link). */
export function deliveryLink(ref: string, delivery: { tokenId: string; expiresAt: Millis }): string {
  return absolute(`/r/${encodeURIComponent(signToken({ p: "delivery", sub: ref, exp: delivery.expiresAt, d: { tokenId: delivery.tokenId } }))}`);
}

const newDelivery = (now: Millis): Delivery => ({ tokenId: randomBytes(12).toString("hex"), expiresAt: now + DELIVERY_TTL_MS, sentAt: null, downloads: 0, lastDownloadAt: null, revokedAt: null });

async function chosenResource(tx: Parameters<typeof enqueueEmailTx>[0], record: ReportRequest, input: ReportRequestInput) {
  const id = input.resourceId || record.resourceId;
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const r = await tx.get<Resource>(docPath("resources", id));
  return r ? { id, r } : null;
}

export const reportRequestMachine = defineMachine<"reportRequest", ReportRequest, ReportRequestInput>({
  workflow: "reportRequest",
  collection: "reportRequests",
  area: "resources",
  guards: {
    approve: async ({ tx, record, input }) => {
      const c = await chosenResource(tx, record, input);
      if (!c) return record.resourceId ? "This report isn't in the library any more." : "Choose which report to send.";
      if (!c.r.file?.storagePath) return "This report has no file yet. Add the PDF in the library first.";
      return null;
    },
    decline: ({ input }) => (input.note && input.note.length > 600 ? "Please keep the note to 600 characters." : null),
  },
  patches: {
    approve: async ({ tx, record, input, viewer, now }) => {
      const c = (await chosenResource(tx, record, input))!;
      input._delivery = newDelivery(now);
      return {
        resourceId: c.id,
        resourceTitle: c.r.title,
        decision: { kind: "approved", by: viewer?.uid ?? "system", at: now, note: null, declineReasonCode: null },
        delivery: input._delivery,
      };
    },
    resend: ({ input, now }) => {
      input._delivery = newDelivery(now);
      return { delivery: input._delivery };
    },
    revoke: ({ now }) => ({ "delivery.revokedAt": now }),
    decline: ({ input, viewer, now }) => ({
      decision: { kind: "declined", by: viewer?.uid ?? "system", at: now, note: input.note?.trim() || null, declineReasonCode: null },
    }),
  },
  effects: {
    approve: ({ tx, record, path, ref, input }) => sendLink(tx, record, path, ref, input._delivery!),
    resend: ({ tx, record, path, ref, input }) => sendLink(tx, record, path, ref, input._delivery!),
    decline: async ({ tx, record, path, ref }) => {
      await enqueueEmailTx(tx, {
        template: "report_declined",
        to: [record.requester.email],
        vars: { reference: ref, firstName: firstNameOf(record.requester.fullName) },
        related: { path, reference: ref },
      });
    },
  },
  summary: ({ edge, actorName, ref }) =>
    edge.id === "approve" ? `${actorName} approved ${ref} and sent the download link` : edge.id === "resend" ? `${actorName} sent ${ref} a fresh link` : edge.id === "revoke" ? `${actorName} stopped the link for ${ref}` : `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
});

/** The delivery email with the /r/ link for the delivery this transaction created. */
async function sendLink(tx: Parameters<typeof enqueueEmailTx>[0], record: ReportRequest, path: string, ref: string, delivery: Delivery): Promise<void> {
  await enqueueEmailTx(tx, {
    template: "report_delivery",
    to: [record.requester.email],
    vars: { reference: ref, firstName: firstNameOf(record.requester.fullName), link: deliveryLink(ref, delivery) },
    related: { path, reference: ref },
    dedupeKey: `${ref}~${delivery.tokenId}`,
  });
}
