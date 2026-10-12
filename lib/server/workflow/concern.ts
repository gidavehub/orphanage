import "server-only";

// The child-protection concern workflow (data-model §5.5; admin-ux §6.5; PLAN D76, D83). Edges come
// from FLOWS; this file adds guards, patches and effects. Every free-text value is sealed with the
// concern's path. Actions (authorities contacted, services, follow-ups) are written to
// safeguardingConcerns/{ref}/actions in the same transaction as the step that needs them. Closing a
// high or immediate risk concern needs a second safeguarding officer's sign-off (requestClosure first,
// then a different person takes the "close" edge).

import type { ConcernAction } from "@/lib/model/domain/case";
import type { ConcernClosureReason, EscalationTarget, SafeguardingConcern } from "@/lib/model/domain/concern";
import type { Millis, Uid } from "@/lib/model/enums";
import type { RiskLevel } from "@/lib/model/status";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { notifyTx } from "@/lib/server/notify";
import { sealField } from "@/lib/server/security/seal";
import { newId } from "@/lib/server/db/convert";
import { defineMachine, type TransitionInput } from "./flow";

export type ConcernActionInput = { kind: ConcernAction["kind"]; detail: string; dueAt?: Millis | null };

export type ConcernInput = TransitionInput & {
  /** assess_risk */
  riskLevel?: RiskLevel;
  rationale?: string;
  /** escalate */
  escalateTo?: EscalationTarget;
  externalRef?: string;
  /** escalate / refer / monitor: the action that goes with the step */
  action?: ConcernActionInput;
  /** close_no_concern / close */
  closureReason?: ConcernClosureReason;
  closingNote?: string;
  /** escalate: who to alert (safeguarding officers and super admins), resolved by the DAL */
  alertUids?: Uid[];
  /** close: whether two-person closure applies (settings/org), resolved by the DAL */
  twoPerson?: boolean;
};

type R = SafeguardingConcern;

export function actionsPath(concernPath: string): string {
  return `${concernPath}/actions`;
}

/** Builds an action document (detail sealed under its own path). */
export function actionDoc(concernPath: string, id: string, a: ConcernActionInput, by: { uid: Uid; name: string }, now: Millis): ConcernAction {
  return {
    kind: a.kind,
    at: now,
    dueAt: a.dueAt ?? null,
    doneAt: null,
    byUid: by.uid,
    byName: by.name,
    detail: sealField(`${actionsPath(concernPath)}/${id}`, "detail", a.detail.trim().slice(0, 2000)),
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

const highRisk = (r: R) => r.riskLevel === "high" || r.riskLevel === "immediate";

export const concernMachine = defineMachine<"concern", R, ConcernInput>({
  workflow: "concern",
  collection: "safeguardingConcerns",
  area: "safeguarding",
  guards: {
    assess_risk: ({ input }) => {
      if (!input.riskLevel) return "Choose how serious this is first.";
      if (!input.rationale?.trim() || input.rationale.trim().length < 10) return "Write a sentence on why you chose this risk level.";
      return null;
    },
    escalate: ({ input }) => {
      if (!input.escalateTo) return "Choose who it was escalated to.";
      if (!input.action?.detail?.trim()) return "Record the contact with the authority: who, when and what was agreed.";
      return null;
    },
    refer: ({ input }) => (input.action?.detail?.trim() ? null : "Record which service you contacted and what was agreed."),
    monitor: ({ input }) => (input.action?.dueAt && input.action.dueAt > Date.now() ? null : "Set the date of the next follow-up."),
    close_no_concern: ({ input }) => {
      if (!input.closureReason || !["no_concern", "duplicate", "spam"].includes(input.closureReason)) return "Choose why it's being closed.";
      if (input.closureReason === "no_concern" && (!input.closingNote?.trim() || input.closingNote.trim().length < 10)) return "Explain why there is no concern.";
      return null;
    },
    close: ({ input, record, viewer }) => {
      if (!input.closureReason) return "Choose why the case is being closed.";
      if (!input.closingNote?.trim()) return "Write a short closing note.";
      if (input.twoPerson && highRisk(record)) {
        if (!record.closure || record.closure.secondSignOffAt) return "This is a high-risk concern: ask for closure first, then a second safeguarding officer confirms it.";
        if (viewer && record.closure.by === viewer.uid) return "Waiting for a second sign-off: another safeguarding officer must confirm the closure.";
      }
      return null;
    },
  },
  patches: {
    screen: ({ record, now }) => (record.acknowledgedAt ? {} : { acknowledgedAt: now }),
    assess_risk: ({ input, viewer, now, path }) => ({
      riskLevel: input.riskLevel!,
      risk: { assessedBy: viewer?.uid ?? "system", assessedAt: now, rationale: sealField(path, "risk.rationale", input.rationale!.trim().slice(0, 2000)) },
    }),
    escalate: ({ input, viewer, now, path }) => ({
      escalation: { at: now, by: viewer?.uid ?? "system", to: input.escalateTo!, externalRef: input.externalRef?.trim() ? sealField(path, "escalation.externalRef", input.externalRef.trim().slice(0, 120)) : null },
    }),
    monitor: ({ input }) => ({ followUpAt: input.action!.dueAt! }),
    close_no_concern: ({ input, viewer, now }) => ({
      closureReason: input.closureReason!,
      closure: { by: viewer?.uid ?? "system", at: now, reason: input.closureReason!, secondSignOffBy: null, secondSignOffAt: null },
      followUpAt: null,
    }),
    close: ({ input, record, viewer, now }) => ({
      closureReason: input.closureReason!,
      closure:
        input.twoPerson && highRisk(record) && record.closure
          ? { ...record.closure, secondSignOffBy: viewer?.uid ?? null, secondSignOffAt: now }
          : { by: viewer?.uid ?? "system", at: now, reason: input.closureReason!, secondSignOffBy: null, secondSignOffAt: null },
      followUpAt: null,
    }),
    reopen: () => ({ closureReason: null, closure: null }),
  },
  effects: {
    escalate: async ({ tx, input, path, ref, viewer, now }) => {
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, { ...input.action!, kind: "contacted_authority" }, { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" }, now));
      const uids = (input.alertUids ?? []).filter((u) => u !== viewer?.uid);
      if (uids.length) {
        notifyTx(tx, { recipientUids: uids, kind: "concern_alert", title: "Urgent item for the safeguarding team", href: "/admin/safeguarding", priority: "urgent" });
        await enqueueEmailTx(tx, { template: "concern_alert", toStaffUids: uids, vars: { priority: "Immediate", link: "/admin/safeguarding" }, dedupeKey: `${ref}~esc~${now}`, related: { path, reference: ref } });
      }
    },
    refer: ({ tx, input, path, viewer, now }) => {
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, { ...input.action!, kind: "contacted_service" }, { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" }, now));
    },
    monitor: ({ tx, input, path, viewer, now }) => {
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, { ...input.action!, kind: "follow_up_due" }, { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" }, now));
    },
    close: ({ tx, input, path, viewer, now }) => {
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, { kind: "other", detail: `Closing note: ${input.closingNote!.trim()}` }, { uid: viewer?.uid ?? "system", name: viewer?.displayName ?? "Haven" }, now));
    },
  },
  // Timeline sentences never describe the concern itself.
  summary: ({ edge, actorName, ref }) => `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
});
