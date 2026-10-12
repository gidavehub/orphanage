import "server-only";

// Privacy requests, the staff side (admin-ux §6.16 Settings › Data; PLAN D104). Edges come from FLOWS:
// Start work, Mark complete (emails `data_request_done`) and Reject (with a reason the record keeps).
// Verification by the requester lives in lib/server/intake/dataRequest.ts.

import type { DataRequest } from "@/lib/model/domain/system";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { firstNameOf } from "@/lib/server/intake/caseBase";
import { defineMachine, type TransitionInput } from "./flow";

export type DataRequestInput = TransitionInput & {
  /** complete: what was done, in a sentence, for the record (never sent to the person). */
  note?: string;
};

export const dataRequestMachine = defineMachine<"dataRequest", DataRequest, DataRequestInput>({
  workflow: "dataRequest",
  collection: "dataRequests",
  area: "privacy",
  guards: {
    complete: ({ input }) => (!input.note || input.note.trim().length < 5 ? "Say briefly what was done, for the record." : input.note.length > 600 ? "Please keep it to 600 characters." : null),
    reject: ({ input }) => (!input.reason || input.reason.trim().length < 10 ? "Give the reason (at least 10 characters)." : null),
  },
  patches: {
    complete: ({ record, input, viewer, now }) => ({
      findings: [...(record.findings ?? []), { path: "dataRequests", action: "no_action" as const, reason: input.note!.trim().slice(0, 600), at: now, by: viewer?.uid ?? "system" }],
    }),
    reject: ({ input }) => ({ rejectionReason: input.reason!.trim().slice(0, 500) }),
  },
  effects: {
    complete: async ({ tx, record, path, ref }) => {
      await enqueueEmailTx(tx, {
        template: "data_request_done",
        to: [record.requester.email],
        vars: { reference: ref, firstName: firstNameOf(record.requester.fullName) },
        related: { path, reference: ref },
      });
    },
  },
  summary: ({ edge, actorName, ref }) => (edge.id === "complete" ? `${actorName} completed privacy request ${ref}` : edge.id === "reject" ? `${actorName} closed privacy request ${ref} without action` : `${actorName} started work on ${ref}`),
});
