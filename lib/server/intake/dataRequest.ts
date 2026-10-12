import "server-only";

// Privacy requests (PLAN D104; data-model §11.5; public-pages §3.21 "Your rights: correct or delete").
//
//   submitDataRequest: runIntake (backend → honeypot + time trap → per-IP-hash limit → zod)
//     → one transaction: the dataRequests record (HVN-DR-YYYY-NNNN, status `unverified`, due in 30
//       days), its "created" timeline event, an audit entry and the `data_request_verify` email whose
//       button carries a signed 7-day token. Only a hash of that token is stored.
//   verifyDataRequest: the link in that email. A valid, unexpired token whose hash matches the record
//     moves it `unverified → verified` through the workflow engine (event + audit in the same commit)
//     and tells the privacy owners (super admins by default) that a confirmed request is waiting.
//     Opening the link again answers "already confirmed"; a tampered or old link answers "expired".
//
// Nothing about the request appears in a notification title or email subject beyond its reference.

import type { FormState } from "@/lib/forms/types";
import type { DataRequest } from "@/lib/model/domain/system";
import type { Millis } from "@/lib/model/enums";
import { routes } from "@/lib/routes";
import { dataRequestSchema, DATA_REQUEST_ECHO_KEYS, type DataRequestData } from "@/lib/schemas/forms/dataRequest";
import { auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx, eventActorOf } from "@/lib/server/events";
import { runIntake } from "@/lib/server/intake/pipeline";
import { log } from "@/lib/server/log";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { adminHrefOfRef, createWithReference } from "@/lib/server/references";
import { sha256Hex, signTokenFor, tokensAvailable, verifyToken } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import { TransitionError, defineMachine, type TransitionInput } from "@/lib/server/workflow/flow";

const DAY = 24 * 60 * 60 * 1000;
/** The verification link works for 7 days (data-model §11.5). */
export const DATA_REQUEST_VERIFY_TTL_MS = 7 * DAY;
/** We answer within 30 days of the request (D104). */
export const DATA_REQUEST_DUE_MS = 30 * DAY;

const NO_TOKENS_MESSAGE =
  "We can't take privacy requests online at the moment. Please email our privacy team instead, and we'll reply within 30 days.";

/** "Fatou" from "Fatou Ceesay" (the only personal detail an email body carries). */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]?.slice(0, 40) || "there";
}

function buildRecord(d: DataRequestData, reference: string, now: Millis, tokenHash: string): DataRequest {
  const emailLower = d.email.toLowerCase();
  return {
    reference,
    status: "unverified",
    statusChangedAt: now,
    assignedTo: null,
    assignedName: null,
    assignedAt: null,
    followUpAt: null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: now,
    closedAt: null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: buildSearchTokens({ reference, email: emailLower, names: [d.fullName], phone: d.phone }),
    retention: { policy: "data_request", retainUntil: null, legalHold: false },
    source: "web_form",
    createdAt: now,
    updatedAt: now,
    version: 1,
    type: d.type,
    requester: { fullName: d.fullName, email: d.email, emailLower, phone: d.phone },
    details: d.details,
    knownReferences: d.knownReferences,
    verifyTokenHash: tokenHash,
    verifiedAt: null,
    dueAt: now + DATA_REQUEST_DUE_MS,
    findings: [],
    rejectionReason: null,
  };
}

/**
 * The /privacy/request Server Action body. Returns the FormState the form renders: on success the
 * DR reference, which the page shows together with "check your email".
 */
export async function submitDataRequest(input: FormData): Promise<FormState<string>> {
  return runIntake({
    form: "data_request",
    input,
    schema: dataRequestSchema,
    echoKeys: DATA_REQUEST_ECHO_KEYS,
    isOpen: async () => tokensAvailable() || NO_TOKENS_MESSAGE,
    create: async (d) => {
      let token = "";
      const reference = await createWithReference(
        "dataRequests",
        (ref, now) => {
          token = signTokenFor("data_request_verify", ref, DATA_REQUEST_VERIFY_TTL_MS);
          return buildRecord(d, ref, now, sha256Hex(token));
        },
        async (tx, ref, now) => {
          const path = docPath("dataRequests", ref);
          addEventTx(tx, path, { type: "created", actor: eventActorOf("public"), summary: "Privacy request received; waiting for the email to be confirmed", at: now });
          auditTx(tx, {
            actor: { kind: "public" },
            action: "privacy.request_created",
            area: "privacy",
            summary: `New privacy request ${ref} (email not yet confirmed)`,
            feed: false,
            targetPath: path,
            targetRef: ref,
          });
          await enqueueEmailTx(tx, {
            template: "data_request_verify",
            to: [d.email],
            vars: { reference: ref, firstName: firstNameOf(d.fullName), link: absolute(routes.privacyVerify(token)) },
            related: { path, reference: ref },
          });
        },
      );
      return { reference };
    },
  });
}

/* ── Verification ──────────────────────────────────────────────────────── */

type VerifyInput = TransitionInput & { tokenHash: string; recipients: string[] };

const verifyMachine = defineMachine<"dataRequest", DataRequest, VerifyInput>({
  workflow: "dataRequest",
  collection: "dataRequests",
  area: "privacy",
  guards: {
    verify: ({ record, input }) =>
      record.verifyTokenHash && record.verifyTokenHash === input.tokenHash ? null : "This confirmation link is no longer valid. Please send the request again.",
  },
  patches: {
    verify: ({ now }) => ({ verifiedAt: now, verifyTokenHash: null }),
  },
  effects: {
    verify: ({ tx, ref, input }) => {
      if (input.recipients.length === 0) return;
      notifyTx(tx, { recipientUids: input.recipients, kind: "new_case", title: `Privacy request ${ref} is confirmed and ready`, href: adminHrefOfRef(ref) });
    },
  },
  summary: () => "The person confirmed their email address",
});

export type VerifyOutcome =
  /** Just confirmed. */
  | { state: "verified"; reference: string }
  /** Confirmed earlier (or already being worked on). */
  | { state: "already"; reference: string }
  /** Tampered, expired, superseded or unknown. */
  | { state: "expired" }
  /** The data backend is not connected. */
  | { state: "unavailable" };

/** Confirms a privacy request from its email link. Never throws. */
export async function verifyDataRequest(token: string | null | undefined): Promise<VerifyOutcome> {
  const claim = verifyToken(token, "data_request_verify");
  if (!claim || !token) return { state: "expired" };
  const reference = claim.sub;
  try {
    const store = getStore();
    const record = await store.get<DataRequest>(docPath("dataRequests", reference));
    if (!record) return { state: "expired" };
    if (record.status !== "unverified") {
      return record.status === "rejected" ? { state: "expired" } : { state: "already", reference };
    }
    const recipients = await recipientsFor("data_request_new");
    await verifyMachine.transition({ ref: reference, edgeId: "verify", actor: { kind: "public" }, input: { tokenHash: sha256Hex(token), recipients } });
    return { state: "verified", reference };
  } catch (err) {
    if (err instanceof TransitionError) return err.code === "no_edge" ? { state: "already", reference } : { state: "expired" };
    if (err instanceof BackendUnavailableError) return { state: "unavailable" };
    log.error("privacy.verify_failed", { err });
    return { state: "unavailable" };
  }
}
