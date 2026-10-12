import "server-only";

// The support request workflow (data-model §5.1; admin-ux §6.4; PLAN D75). Edges come from FLOWS;
// this file adds the guards (the plain sentence shown when a step isn't possible yet), the patches
// and the effects (emails through the outbox, the assignee notification), all inside the engine's one
// transaction.

import type { SupportRequest, SupportReferral } from "@/lib/model/domain/support";
import type { ReferralType, Uid } from "@/lib/model/enums";
import { inProgrammeScope } from "@/lib/server/auth/permissions";
import { adminHrefOfRef } from "@/lib/model/refs";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addNoteTx } from "@/lib/server/events";
import { notifyTx } from "@/lib/server/notify";
import { defineMachine, type TransitionInput } from "./flow";

const DAY = 86_400_000;

export const SUPPORT_DECLINE_REASONS = ["out_of_scope", "not_eligible", "no_capacity", "duplicate", "referred_elsewhere", "other"] as const;
export const SUPPORT_CLOSE_REASONS = ["duplicate", "spam", "withdrawn"] as const;

export type SupportInput = TransitionInput & {
  /** assign */
  assignee?: { uid: Uid; name: string };
  /** ask_more_info: what the team needs (shown in the email and kept as a note). */
  message?: string;
  /** ask_more_info without an email address: how the person was asked by phone. */
  callNote?: string;
  /** refer */
  referral?: { partnerId: string | null; toName: string; toType: ReferralType; note: string | null; consentToShare: boolean };
  /** complete */
  outcome?: string;
  /** decline */
  reasonCode?: (typeof SUPPORT_DECLINE_REASONS)[number];
  note?: string;
  letThemKnow?: boolean;
  /** close_duplicate */
  closeReason?: (typeof SUPPORT_CLOSE_REASONS)[number];
};

type R = SupportRequest;

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

const dateLabel = (ms: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" }).format(ms);

export const supportMachine = defineMachine<"support", R, SupportInput>({
  workflow: "support",
  collection: "supportRequests",
  area: "support",
  // Programme officers work only inside their programme scope.
  authorize: ({ viewer, record }) => !viewer || inProgrammeScope(viewer, record.programmeId),
  guards: {
    assign: ({ input }) => (input.assignee?.uid ? null : "Choose who will look after this request first."),
    ask_more_info: ({ input, record }) => {
      if (!input.message?.trim()) return "Write what you need from them first.";
      if (!record.applicant.email && !input.callNote?.trim()) return "There's no email address: call them, then note what you asked.";
      return null;
    },
    refer: ({ input }) => {
      const r = input.referral;
      if (!r?.toName?.trim()) return "Say who you referred them to.";
      if (!r.consentToShare) return "Confirm they agreed we can share their details before recording the referral.";
      return null;
    },
    approve: ({ record }) => {
      const t = record.triage;
      if (t?.verification?.status !== "verified") return "Check and verify the request first, then you can approve it.";
      if (t.eligibility !== "eligible") return "Mark the request as eligible first, then you can approve it.";
      return null;
    },
    complete: ({ input }) => (input.outcome?.trim() && input.outcome.trim().length >= 10 ? null : "Write a short outcome (what support was given) to complete the request."),
    decline: ({ input }) => (input.reasonCode ? null : "Choose a reason for declining first."),
    close_duplicate: ({ input }) => (input.closeReason ? null : "Choose why it's being closed."),
  },
  patches: {
    start_review: ({ record, viewer, now }) =>
      record.assignedTo || !viewer ? {} : { assignedTo: viewer.uid, assignedName: viewer.displayName, assignedAt: now },
    assign: ({ input, now }) => ({ assignedTo: input.assignee!.uid, assignedName: input.assignee!.name, assignedAt: now }),
    ask_more_info: ({ now, record }) => ({
      moreInfo: { requestedAt: now, dueAt: now + 14 * DAY, channel: record.applicant.email ? "email" : record.applicant.preferredContact },
    }),
    info_received: () => ({ moreInfo: null }),
    refer: ({ input, record, viewer, now }) => {
      const r = input.referral!;
      const entry: SupportReferral = {
        id: `rf-${now.toString(36)}`,
        partnerId: r.partnerId,
        toName: r.toName.trim().slice(0, 120),
        toType: r.toType,
        consentToShare: true,
        outcome: "waiting",
        outcomeAt: null,
        note: r.note?.trim().slice(0, 500) || null,
        at: now,
        by: viewer?.uid ?? "system",
      };
      return { referrals: [...(record.referrals ?? []), entry] };
    },
    approve: ({ viewer, now }) => ({ decision: { kind: "approved", reasonCode: null, note: null, by: viewer?.uid ?? "system", at: now } }),
    complete: ({ input, viewer, now }) => ({ outcome: { summary: input.outcome!.trim().slice(0, 500), at: now, by: viewer?.uid ?? "system" } }),
    decline: ({ input, viewer, now }) => ({
      decision: { kind: "declined", reasonCode: input.reasonCode!, note: input.note?.trim().slice(0, 500) || null, by: viewer?.uid ?? "system", at: now },
    }),
    close_duplicate: ({ input }) => ({ closureReason: input.closeReason! }),
    close_no_response: () => ({ closureReason: "no_response" }),
    close: ({ record }) => ({ closureReason: record.decision?.kind === "declined" ? "declined" : "completed" }),
    reopen: () => ({ closureReason: null }),
  },
  effects: {
    assign: ({ tx, input, ref, viewer }) => {
      if (input.assignee && input.assignee.uid !== viewer?.uid) {
        notifyTx(tx, { recipientUids: [input.assignee.uid], kind: "assigned_to_you", title: `${ref} is now yours`, href: adminHrefOfRef(ref, "support") });
      }
    },
    ask_more_info: async ({ tx, input, record, ref, path, viewer, now }) => {
      const author = { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" };
      addNoteTx(tx, path, { kind: "follow_up", body: `Asked for more information: ${input.message!.trim()}${input.callNote ? `\n\nBy phone: ${input.callNote.trim()}` : ""}`, author }, { event: false });
      if (record.applicant.email) {
        await enqueueEmailTx(tx, {
          template: "support_more_info",
          to: [record.applicant.email],
          vars: { reference: ref, firstName: firstName(record.applicant.fullName), message: input.message!.trim(), dueDate: dateLabel(now + 14 * DAY) },
          related: { path, reference: ref },
          dedupeKey: `${ref}~more~${now}`,
        });
      }
    },
    complete: ({ tx, input, path, viewer }) => {
      addNoteTx(tx, path, { kind: "decision", body: `Outcome: ${input.outcome!.trim()}`, author: { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" } }, { event: false });
    },
    decline: async ({ tx, input, record, ref, path, now }) => {
      if (input.letThemKnow !== false && record.applicant.email) {
        await enqueueEmailTx(tx, {
          template: "support_declined",
          to: [record.applicant.email],
          vars: { reference: ref, firstName: firstName(record.applicant.fullName) },
          related: { path, reference: ref },
          dedupeKey: `${ref}~declined~${now}`,
        });
      }
    },
  },
  summary: ({ edge, actorName, ref, input }) => {
    if (edge.id === "assign" && input.assignee) return `${actorName} gave ${ref} to ${input.assignee.name.split(" ")[0]}`;
    return `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`;
  },
});
