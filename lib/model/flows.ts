// Workflow state machines as pure data (client-safe). The single source for server transitions
// (lib/server/workflow/flow.ts adds guards and effects) and for the admin StatusStepper
// (admin-ux §7's Flow shape is derived by toStepperFlow, never hand-written).
//
// Edges follow data-model §5.1–5.6 exactly (PLAN D75–D78), posts follow content-model §7.1, and
// story submissions follow D58. `who` lists the permissions (any of) or system actors allowed to
// take an edge. Super admins hold every permission, so they pass every permission-gated edge.

import { STATUS_LABEL } from "./labels";
import type { Permission } from "./permissions";
import { OPEN_STATUSES, type StatusOf, type Workflow } from "./status";

/** What the UI must collect before an edge can be taken. */
export type Ask =
  | "reason"
  | "reasonAndEmail"
  | "emailTemplate"
  | "referral"
  | "risk"
  | "secondSignOff"
  | "schedule"
  | "allocation"
  | "refund"
  | "outcome"
  | "assignee";

/** A permission, or a non-staff actor. `assigned_counsellor` means "the counsellor on this session". */
export type EdgeActor = Permission | "system" | "stripe" | "public" | "assigned_counsellor";

export interface EdgeSpec<S extends string> {
  /** Stable id, unique within its workflow (used by the server for guards, effects and audit). */
  id: string;
  /** Source statuses, or every open status of the workflow (OPEN_STATUSES). */
  from: readonly S[] | "any_open";
  to: S;
  who: readonly EdgeActor[];
  /** Staff-facing button text ("next step"). */
  verb: string;
  asks?: Ask;
  /** Reopening: a reason of at least 10 characters is required and the event is logged as "reopened". */
  reopen?: true;
  /** The edge queues an email (some only when an address exists or the person ticks "Let them know"). */
  sendsEmail?: boolean;
}

export interface FlowSpec<S extends string> {
  workflow: Workflow;
  /** What "New" means for the Inbox. */
  initial: S;
  /** The dots on the stepper, in order. */
  path: readonly S[];
  /** Shown as a flag on the current dot (not a dot). */
  pauses: readonly S[];
  /** Off-ramps shown at the end (neutral, never red). */
  exits: readonly S[];
  /** Finished statuses (retention starts, closedAt is set). */
  terminal: readonly S[];
  edges: readonly EdgeSpec<S>[];
}

/** Marker for super-admin-only edges: `settings.manage` is held by no role other than super_admin. */
const SA_ONLY: Permission = "settings.manage";

const support: FlowSpec<StatusOf<"support">> = {
  workflow: "support",
  initial: "new",
  path: ["new", "under_review", "assigned", "referred", "approved", "support_in_progress", "completed", "closed"],
  pauses: ["more_info_required"],
  exits: ["declined"],
  terminal: ["closed"],
  edges: [
    { id: "start_review", from: ["new"], to: "under_review", who: ["support.manage"], verb: "Start review" },
    { id: "assign", from: ["under_review"], to: "assigned", who: ["support.manage"], verb: "Assign to…", asks: "assignee" },
    {
      id: "ask_more_info",
      from: ["under_review", "assigned"],
      to: "more_info_required",
      who: ["support.manage"],
      verb: "Ask for more information",
      asks: "emailTemplate",
      sendsEmail: true,
    },
    { id: "info_received", from: ["more_info_required"], to: "under_review", who: ["support.manage"], verb: "Information received" },
    { id: "refer", from: ["under_review", "assigned"], to: "referred", who: ["support.manage"], verb: "Record a referral", asks: "referral" },
    { id: "approve", from: ["under_review", "assigned", "referred"], to: "approved", who: ["support.manage"], verb: "Approve support" },
    { id: "start_support", from: ["approved", "referred"], to: "support_in_progress", who: ["support.manage", "system"], verb: "Start support" },
    { id: "complete", from: ["support_in_progress", "referred"], to: "completed", who: ["support.manage"], verb: "Mark as complete", asks: "outcome" },
    {
      id: "decline",
      from: ["new", "under_review", "assigned", "referred"],
      to: "declined",
      who: ["support.manage"],
      verb: "Decline",
      asks: "reasonAndEmail",
      sendsEmail: true,
    },
    { id: "close_duplicate", from: ["new", "under_review"], to: "closed", who: ["support.manage"], verb: "Close (duplicate or spam)", asks: "reason" },
    { id: "close_no_response", from: ["more_info_required"], to: "closed", who: ["support.manage", "system"], verb: "Close: no response" },
    { id: "close", from: ["completed", "declined"], to: "closed", who: ["support.manage", "system"], verb: "Close case" },
    { id: "move_to_safeguarding", from: "any_open", to: "closed", who: ["support.manage"], verb: "Move to safeguarding", asks: "reason" },
    { id: "reopen", from: ["closed"], to: "under_review", who: ["support.manage"], verb: "Reopen", asks: "reason", reopen: true },
  ],
};

const concern: FlowSpec<StatusOf<"concern">> = {
  workflow: "concern",
  initial: "received",
  path: ["received", "screening", "risk_assessed", "escalated", "referred", "monitoring", "closed"],
  pauses: [],
  exits: [],
  terminal: ["closed"],
  edges: [
    { id: "screen", from: ["received"], to: "screening", who: ["concern.manage"], verb: "Open and screen" },
    { id: "assess_risk", from: ["screening"], to: "risk_assessed", who: ["concern.manage"], verb: "Record risk level", asks: "risk" },
    { id: "escalate", from: ["risk_assessed", "monitoring"], to: "escalated", who: ["concern.manage"], verb: "Escalate now", asks: "referral" },
    {
      id: "refer",
      from: ["risk_assessed", "escalated", "monitoring"],
      to: "referred",
      who: ["concern.manage"],
      verb: "Record referral to services",
      asks: "referral",
    },
    { id: "monitor", from: ["risk_assessed", "escalated", "referred"], to: "monitoring", who: ["concern.manage"], verb: "Monitor and follow up", asks: "schedule" },
    {
      id: "close_no_concern",
      from: ["screening", "risk_assessed"],
      to: "closed",
      who: ["concern.manage"],
      verb: "Close: no concern, duplicate or spam",
      asks: "reason",
    },
    { id: "close", from: "any_open", to: "closed", who: ["concern.manage"], verb: "Close case", asks: "secondSignOff" },
    { id: "reopen", from: ["closed"], to: "screening", who: ["concern.manage"], verb: "Reopen", asks: "reason", reopen: true },
  ],
};

const appointment: FlowSpec<StatusOf<"appointment">> = {
  workflow: "appointment",
  initial: "scheduled",
  path: ["scheduled", "completed"],
  pauses: [],
  exits: ["no_show", "cancelled"],
  terminal: ["completed", "no_show", "cancelled"],
  edges: [
    { id: "reschedule", from: ["scheduled"], to: "scheduled", who: ["appointment.manage"], verb: "Reschedule", asks: "schedule", sendsEmail: true },
    { id: "attended", from: ["scheduled"], to: "completed", who: ["appointment.manage", "assigned_counsellor"], verb: "Mark attended" },
    { id: "no_show", from: ["scheduled"], to: "no_show", who: ["appointment.manage", "assigned_counsellor"], verb: "Mark no-show" },
    {
      id: "client_cancelled",
      from: ["scheduled"],
      to: "cancelled",
      who: ["appointment.manage", "assigned_counsellor"],
      verb: "Client cancelled",
      sendsEmail: true,
    },
    { id: "cancel", from: ["scheduled"], to: "cancelled", who: ["appointment.manage"], verb: "Cancel session", asks: "reason", sendsEmail: true },
    {
      id: "correct",
      from: ["completed", "no_show"],
      to: "scheduled",
      who: ["appointment.manage"],
      verb: "Correct attendance",
      asks: "reason",
      reopen: true,
    },
  ],
};

const donationEdges: EdgeSpec<StatusOf<"donation">>[] = [
  { id: "confirm_arrangement", from: ["pledged"], to: "pending", who: ["donation.manage"], verb: "Confirm arrangement" },
  { id: "receive", from: ["pledged", "pending"], to: "received", who: ["donation.manage", "stripe"], verb: "Mark as received" },
  {
    id: "acknowledge",
    from: ["received"],
    to: "acknowledged",
    who: ["donation.manage", "system"],
    verb: "Send thank-you and receipt",
    sendsEmail: true,
  },
  { id: "allocate", from: ["acknowledged"], to: "allocated", who: ["donation.manage", "system"], verb: "Allocate to programmes", asks: "allocation" },
  { id: "reallocate", from: ["allocated"], to: "allocated", who: ["donation.manage"], verb: "Change allocation", asks: "allocation" },
  { id: "complete", from: ["allocated"], to: "completed", who: ["donation.manage"], verb: "Mark funds used / items distributed" },
  { id: "cancel_pledge", from: ["pledged", "pending"], to: "cancelled", who: ["donation.manage", "stripe"], verb: "Cancel pledge", asks: "reason" },
  {
    id: "refund",
    from: ["received", "acknowledged", "allocated"],
    to: "cancelled",
    who: ["donation.manage", "stripe"],
    verb: "Record refund",
    asks: "refund",
    sendsEmail: true,
  },
  { id: "reopen", from: ["cancelled"], to: "pledged", who: [SA_ONLY], verb: "Reopen", asks: "reason", reopen: true },
];

const donation: FlowSpec<StatusOf<"donation">> = {
  workflow: "donation",
  initial: "pledged",
  path: ["pledged", "pending", "received", "acknowledged", "allocated", "completed"],
  pauses: [],
  exits: ["cancelled"],
  terminal: ["completed", "cancelled"],
  edges: donationEdges,
};

/** In-kind offers share DonationStatus and the donation edges, without Stripe and refunds (D72). */
const INKIND_VERBS: Record<string, string> = {
  confirm_arrangement: "Arrange pickup or drop-off",
  receive: "Mark items received",
  acknowledge: "Say thank you",
  allocate: "Give to a programme",
  reallocate: "Change where they went",
  complete: "Mark items distributed",
  cancel_pledge: "Cancel the offer",
};

const inkind: FlowSpec<StatusOf<"inkind">> = {
  workflow: "inkind",
  initial: "pledged",
  path: ["pledged", "pending", "received", "acknowledged", "allocated", "completed"],
  pauses: [],
  exits: ["cancelled"],
  terminal: ["completed", "cancelled"],
  edges: donationEdges
    .filter((e) => e.id !== "refund")
    .map((e) => ({
      ...e,
      who: e.who.filter((a) => a !== "stripe"),
      verb: INKIND_VERBS[e.id] ?? e.verb,
      sendsEmail: e.id === "confirm_arrangement" ? true : e.sendsEmail,
    })),
};

const recurring: FlowSpec<StatusOf<"recurring">> = {
  workflow: "recurring",
  initial: "incomplete",
  path: ["incomplete", "active"],
  pauses: ["past_due", "paused"],
  exits: ["cancelled"],
  terminal: ["cancelled"],
  edges: [
    { id: "activate", from: ["incomplete", "past_due", "paused"], to: "active", who: ["stripe", "donation.manage"], verb: "Mark active" },
    { id: "payment_failed", from: ["active"], to: "past_due", who: ["stripe"], verb: "Payment failed" },
    { id: "pause", from: ["active", "past_due"], to: "paused", who: ["stripe", "donation.manage"], verb: "Pause this gift" },
    {
      id: "cancel",
      from: ["incomplete", "active", "past_due", "paused"],
      to: "cancelled",
      who: ["stripe", "donation.manage"],
      verb: "Stop this gift",
      asks: "reason",
      sendsEmail: true,
    },
  ],
};

const volunteer: FlowSpec<StatusOf<"volunteer">> = {
  workflow: "volunteer",
  initial: "submitted",
  path: ["submitted", "screening", "interview", "approved", "onboarding", "active"],
  pauses: ["inactive"],
  exits: ["declined"],
  terminal: ["inactive", "declined"],
  edges: [
    { id: "screen", from: ["submitted"], to: "screening", who: ["volunteer.manage"], verb: "Start screening" },
    { id: "interview", from: ["screening"], to: "interview", who: ["volunteer.manage"], verb: "Invite to interview", asks: "schedule" },
    { id: "approve", from: ["screening", "interview"], to: "approved", who: ["volunteer.manage"], verb: "Approve" },
    { id: "onboard", from: ["approved"], to: "onboarding", who: ["volunteer.manage"], verb: "Start onboarding" },
    { id: "activate", from: ["onboarding"], to: "active", who: ["volunteer.manage"], verb: "Mark active" },
    { id: "inactivate", from: ["approved", "onboarding", "active"], to: "inactive", who: ["volunteer.manage"], verb: "Mark inactive" },
    { id: "reactivate", from: ["inactive"], to: "active", who: ["volunteer.manage"], verb: "Reactivate" },
    { id: "decline", from: ["submitted", "screening", "interview"], to: "declined", who: ["volunteer.manage"], verb: "Decline", asks: "reason" },
    { id: "reopen", from: ["declined"], to: "screening", who: [SA_ONLY], verb: "Reopen", asks: "reason", reopen: true },
  ],
};

const partnership: FlowSpec<StatusOf<"partnership">> = {
  workflow: "partnership",
  initial: "new",
  path: ["new", "under_review", "in_discussion", "agreed", "active", "closed"],
  pauses: [],
  exits: ["declined"],
  terminal: ["declined", "closed"],
  edges: [
    { id: "start_review", from: ["new"], to: "under_review", who: ["partnership.manage"], verb: "Start review" },
    { id: "discuss", from: ["under_review"], to: "in_discussion", who: ["partnership.manage"], verb: "Start talking" },
    { id: "agree", from: ["in_discussion"], to: "agreed", who: ["partnership.manage"], verb: "Record the agreement" },
    { id: "activate", from: ["agreed"], to: "active", who: ["partnership.manage"], verb: "Mark active" },
    { id: "close", from: ["active"], to: "closed", who: ["partnership.manage"], verb: "Close", asks: "reason" },
    { id: "decline", from: "any_open", to: "declined", who: ["partnership.manage"], verb: "Decline", asks: "reason" },
    { id: "reopen", from: ["closed"], to: "under_review", who: ["partnership.manage"], verb: "Reopen", asks: "reason", reopen: true },
  ],
};

const contact: FlowSpec<StatusOf<"contact">> = {
  workflow: "contact",
  initial: "new",
  path: ["new", "replied", "closed"],
  pauses: [],
  exits: ["spam"],
  terminal: ["closed", "spam"],
  edges: [
    { id: "reply", from: ["new"], to: "replied", who: ["contact.manage"], verb: "Reply", asks: "emailTemplate", sendsEmail: true },
    { id: "close", from: ["new", "replied"], to: "closed", who: ["contact.manage"], verb: "Mark as done" },
    { id: "spam", from: ["new", "replied", "closed"], to: "spam", who: ["contact.manage"], verb: "Mark as spam" },
  ],
};

const reportRequest: FlowSpec<StatusOf<"reportRequest">> = {
  workflow: "reportRequest",
  initial: "new",
  path: ["new", "under_review", "approved", "sent", "closed"],
  pauses: [],
  exits: ["declined"],
  terminal: ["closed"],
  edges: [
    { id: "start_review", from: ["new"], to: "under_review", who: ["reportRequest.manage"], verb: "Start review" },
    { id: "approve", from: ["new", "under_review"], to: "approved", who: ["reportRequest.manage"], verb: "Approve and send", sendsEmail: true },
    { id: "sent", from: ["approved"], to: "sent", who: ["system"], verb: "Mark as sent" },
    { id: "resend", from: ["approved"], to: "approved", who: ["reportRequest.manage"], verb: "Resend link", sendsEmail: true },
    { id: "revoke", from: ["sent"], to: "sent", who: ["reportRequest.manage"], verb: "Revoke link" },
    {
      id: "decline",
      from: ["new", "under_review"],
      to: "declined",
      who: ["reportRequest.manage"],
      verb: "Decline",
      asks: "reasonAndEmail",
      sendsEmail: true,
    },
    { id: "close", from: ["sent", "declined"], to: "closed", who: ["reportRequest.manage", "system"], verb: "Close" },
    { id: "reopen", from: ["closed"], to: "under_review", who: ["reportRequest.manage"], verb: "Reopen", asks: "reason", reopen: true },
  ],
};

const dataRequest: FlowSpec<StatusOf<"dataRequest">> = {
  workflow: "dataRequest",
  initial: "unverified",
  path: ["unverified", "verified", "in_progress", "completed"],
  pauses: [],
  exits: ["rejected"],
  terminal: ["completed", "rejected"],
  edges: [
    { id: "verify", from: ["unverified"], to: "verified", who: ["public"], verb: "Email confirmed" },
    { id: "start", from: ["verified"], to: "in_progress", who: ["privacy.manage"], verb: "Start work" },
    { id: "complete", from: ["in_progress"], to: "completed", who: ["privacy.manage"], verb: "Mark complete", sendsEmail: true },
    { id: "reject", from: ["verified", "in_progress"], to: "rejected", who: ["privacy.manage"], verb: "Reject", asks: "reason" },
  ],
};

const post: FlowSpec<StatusOf<"post">> = {
  workflow: "post",
  initial: "draft",
  path: ["draft", "in_review", "scheduled", "published"],
  pauses: [],
  exits: ["archived"],
  terminal: ["archived"],
  edges: [
    { id: "submit", from: ["draft"], to: "in_review", who: ["post.draft", "post.publish"], verb: "Send for review", sendsEmail: true },
    { id: "request_changes", from: ["in_review"], to: "draft", who: ["post.publish"], verb: "Ask for changes", asks: "reason" },
    { id: "schedule", from: ["in_review"], to: "scheduled", who: ["post.publish"], verb: "Schedule", asks: "schedule" },
    { id: "publish", from: ["in_review"], to: "published", who: ["post.publish"], verb: "Put live" },
    { id: "publish_due", from: ["scheduled"], to: "published", who: ["system"], verb: "Publish on schedule" },
    { id: "unpublish", from: ["published"], to: "draft", who: ["post.publish"], verb: "Take down to edit" },
    { id: "archive", from: ["published"], to: "archived", who: ["post.publish"], verb: "Archive" },
  ],
};

const storySubmission: FlowSpec<StatusOf<"storySubmission">> = {
  workflow: "storySubmission",
  initial: "new",
  path: ["new", "reviewing", "published", "closed"],
  pauses: [],
  exits: ["declined"],
  terminal: ["closed"],
  edges: [
    { id: "review", from: ["new"], to: "reviewing", who: ["storySubmission.manage"], verb: "Start reviewing" },
    { id: "publish", from: ["reviewing"], to: "published", who: ["storySubmission.manage"], verb: "Mark as published" },
    { id: "decline", from: ["new", "reviewing"], to: "declined", who: ["storySubmission.manage"], verb: "Decline", asks: "reason" },
    { id: "close", from: ["published", "declined"], to: "closed", who: ["storySubmission.manage"], verb: "Close" },
  ],
};

export const FLOWS: { [W in Workflow]: FlowSpec<StatusOf<W>> } = {
  support,
  concern,
  appointment,
  donation,
  inkind,
  recurring,
  volunteer,
  partnership,
  contact,
  reportRequest,
  dataRequest,
  post,
  storySubmission,
};

function edgeStartsAt<W extends Workflow>(w: W, e: EdgeSpec<StatusOf<W>>, from: StatusOf<W>): boolean {
  if (e.from === "any_open") return (OPEN_STATUSES[w] as readonly string[]).includes(from);
  return (e.from as readonly string[]).includes(from);
}

/** Every edge that leaves `from`, whoever may take it. */
export function edgesFrom<W extends Workflow>(w: W, from: StatusOf<W>): EdgeSpec<StatusOf<W>>[] {
  const flow = FLOWS[w] as FlowSpec<StatusOf<W>>;
  return flow.edges.filter((e) => edgeStartsAt(w, e, from));
}

/** True when a staff member with `perms` may take the edge (system, Stripe and public edges never). */
export function canTakeEdge<S extends string>(
  e: EdgeSpec<S>,
  perms: ReadonlySet<Permission>,
  ctx?: { isAssignedCounsellor?: boolean },
): boolean {
  return e.who.some((actor) => {
    if (actor === "system" || actor === "stripe" || actor === "public") return false;
    if (actor === "assigned_counsellor") {
      return ctx?.isAssignedCounsellor === true && (perms.has("appointment.own") || perms.has("appointment.manage"));
    }
    return perms.has(actor);
  });
}

/** Edges out of `from` that this staff member may take, in the order the stepper offers them. */
export function allowedEdges<W extends Workflow>(
  w: W,
  from: StatusOf<W>,
  perms: ReadonlySet<Permission>,
  ctx?: { isAssignedCounsellor?: boolean },
): EdgeSpec<StatusOf<W>>[] {
  return edgesFrom(w, from).filter((e) => canTakeEdge(e, perms, ctx));
}

/** The edge with this id, or undefined. */
export function edgeById<W extends Workflow>(w: W, id: string): EdgeSpec<StatusOf<W>> | undefined {
  return (FLOWS[w] as FlowSpec<StatusOf<W>>).edges.find((e) => e.id === id);
}

/** The admin-ux §7 stepper shape, derived from FLOWS (self-edges such as "Change allocation" are actions, not moves). */
export type StepperFlow<S extends string> = {
  path: S[];
  pauses: S[];
  exits: S[];
  labels: Record<S, string>;
  next: Record<S, S[]>;
  verbs: Partial<Record<S, string>>;
  asks: Partial<Record<S, Ask>>;
  initial: S;
};

export function toStepperFlow<W extends Workflow>(w: W): StepperFlow<StatusOf<W>> {
  type S = StatusOf<W>;
  const flow = FLOWS[w] as FlowSpec<S>;
  const labels = { ...(STATUS_LABEL[w] as Record<S, string>) };
  const statuses = Object.keys(labels) as S[];
  const next = {} as Record<S, S[]>;
  const verbs: Partial<Record<S, string>> = {};
  const asks: Partial<Record<S, Ask>> = {};
  for (const s of statuses) {
    const targets: S[] = [];
    for (const e of edgesFrom(w, s)) {
      if (e.to === s || targets.includes(e.to)) continue;
      targets.push(e.to);
    }
    next[s] = targets;
  }
  for (const e of flow.edges) {
    const isSelf = e.from !== "any_open" && e.from.length === 1 && e.from[0] === e.to;
    if (isSelf || verbs[e.to] !== undefined) continue;
    verbs[e.to] = e.verb;
    if (e.asks) asks[e.to] = e.asks;
  }
  return {
    path: [...flow.path],
    pauses: [...flow.pauses],
    exits: [...flow.exits],
    labels,
    next,
    verbs,
    asks,
    initial: flow.initial,
  };
}
