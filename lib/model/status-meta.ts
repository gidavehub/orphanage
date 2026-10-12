// Status → tone and icon (client-safe), design-system Appendix A keyed by data-model status ids.
// StatusPill and StatusStepper read this. Colour is never the only signal: every pill shows its
// words plus a marker icon. Labels come from lib/model/labels.ts.

import type { Urgency } from "./dto";
import { RISK_LABEL, RISK_UNASSESSED_LABEL, STATUS_LABEL } from "./labels";
import type { RecordKind } from "./refs";
import type { RiskLevel, StatusOf, Workflow } from "./status";

/** Visual families of status pills (design-system §3.4). */
export type StatusTone =
  | "new"
  | "review"
  | "waiting"
  | "active"
  | "referred"
  | "approved"
  | "done"
  | "declined"
  | "closed"
  | "urgent"
  | "restricted";

/** Marker drawn before the words. `pulse` is static under reduced motion. */
export type StatusIcon = "dot" | "pulse" | "clock" | "arrow" | "check" | "x" | "lock" | "sparkles" | "alert";

export type StatusMetaEntry = { label: string; tone: StatusTone; icon?: StatusIcon };

/** Default marker per tone (design-system §3.4 table). */
export const TONE_ICON: Record<StatusTone, StatusIcon | undefined> = {
  new: "pulse",
  review: "dot",
  waiting: "clock",
  active: "dot",
  referred: "arrow",
  approved: "check",
  done: "check",
  declined: "x",
  closed: undefined,
  urgent: "pulse",
  restricted: "lock",
};

type ToneMap<W extends Workflow> = Record<StatusOf<W>, StatusTone | { tone: StatusTone; icon: StatusIcon }>;

const TONES: { [W in Workflow]: ToneMap<W> } = {
  support: {
    new: "new",
    under_review: "review",
    more_info_required: "waiting",
    assigned: "active",
    referred: "referred",
    approved: "approved",
    support_in_progress: "active",
    completed: "done",
    declined: "declined",
    closed: "closed",
  },
  concern: {
    received: "new",
    screening: "review",
    risk_assessed: "active",
    escalated: "referred",
    referred: "referred",
    monitoring: "waiting",
    closed: "closed",
  },
  appointment: {
    scheduled: "active",
    completed: "done",
    no_show: "waiting",
    cancelled: "closed",
  },
  donation: {
    pledged: "new",
    pending: "waiting",
    received: "approved",
    acknowledged: "active",
    allocated: "referred",
    completed: "done",
    cancelled: "closed",
  },
  inkind: {
    pledged: "new",
    pending: "waiting",
    received: "approved",
    acknowledged: "active",
    allocated: "referred",
    completed: "done",
    cancelled: "closed",
  },
  recurring: {
    incomplete: "new",
    active: "active",
    past_due: "waiting",
    paused: "review",
    cancelled: "closed",
  },
  volunteer: {
    submitted: "new",
    screening: "review",
    interview: "waiting",
    approved: "approved",
    onboarding: "active",
    active: "done",
    inactive: "closed",
    declined: "declined",
  },
  partnership: {
    new: "new",
    under_review: "review",
    in_discussion: "active",
    agreed: "approved",
    active: "done",
    declined: "declined",
    closed: "closed",
  },
  contact: {
    new: "new",
    replied: "active",
    closed: "closed",
    spam: "declined",
  },
  reportRequest: {
    new: "new",
    under_review: "review",
    approved: "approved",
    sent: "done",
    declined: "declined",
    closed: "closed",
  },
  dataRequest: {
    unverified: "waiting",
    verified: "new",
    in_progress: "active",
    completed: "done",
    rejected: "declined",
  },
  post: {
    draft: { tone: "new", icon: "dot" },
    in_review: "review",
    scheduled: { tone: "active", icon: "clock" },
    published: "done",
    archived: "closed",
  },
  storySubmission: {
    new: "new",
    reviewing: "review",
    published: "done",
    declined: "declined",
    closed: "closed",
  },
};

function build<W extends Workflow>(w: W): Record<StatusOf<W>, StatusMetaEntry> {
  const tones = TONES[w] as Record<string, StatusTone | { tone: StatusTone; icon: StatusIcon }>;
  const labels = STATUS_LABEL[w] as Record<string, string>;
  const out: Record<string, StatusMetaEntry> = {};
  for (const status of Object.keys(labels)) {
    const t = tones[status] ?? "closed";
    const entry: StatusMetaEntry =
      typeof t === "string" ? { label: labels[status], tone: t, icon: TONE_ICON[t] } : { label: labels[status], tone: t.tone, icon: t.icon };
    out[status] = entry;
  }
  return out as Record<StatusOf<W>, StatusMetaEntry>;
}

export const STATUS_META: { [W in Workflow]: Record<StatusOf<W>, StatusMetaEntry> } = {
  support: build("support"),
  concern: build("concern"),
  appointment: build("appointment"),
  donation: build("donation"),
  inkind: build("inkind"),
  recurring: build("recurring"),
  volunteer: build("volunteer"),
  partnership: build("partnership"),
  contact: build("contact"),
  reportRequest: build("reportRequest"),
  dataRequest: build("dataRequest"),
  post: build("post"),
  storySubmission: build("storySubmission"),
};

export function statusMeta<W extends Workflow>(w: W, s: StatusOf<W>): StatusMetaEntry {
  return (STATUS_META[w] as Record<string, StatusMetaEntry>)[s] ?? { label: String(s), tone: "closed" };
}

/**
 * Risk pill (a separate pill on concerns; the text always reads "Risk: …"). `high` is its own
 * look: coral-100 background, coral-800 text and an alert triangle.
 */
export const RISK_META: Record<RiskLevel | "unassessed", { label: string; tone: StatusTone | "high"; icon?: StatusIcon }> = {
  immediate: { label: RISK_LABEL.immediate, tone: "urgent", icon: "pulse" },
  high: { label: RISK_LABEL.high, tone: "high", icon: "alert" },
  medium: { label: RISK_LABEL.medium, tone: "waiting", icon: "clock" },
  low: { label: RISK_LABEL.low, tone: "review", icon: "dot" },
  no_concern: { label: RISK_LABEL.no_concern, tone: "closed", icon: "check" },
  unassessed: { label: RISK_UNASSESSED_LABEL, tone: "closed" },
};

export function riskMeta(level: RiskLevel | null | undefined) {
  return RISK_META[level ?? "unassessed"];
}

/**
 * Kind tints for 4px row bars and place-tile blobs (admin-ux §10.3), as colour token names:
 * use `var(--color-<tint>)`. Messages use `edge`, the closest token to the doc's warm grey.
 */
export const KIND_TINT: Record<RecordKind, string> = {
  support: "forest",
  concern: "deep",
  gift: "marigold",
  inkind: "clay",
  recurring: "marigold-600",
  session: "cocoa",
  reportRequest: "umber",
  volunteer: "forest-700",
  partner: "clay-700",
  message: "edge",
  story: "coral-700",
  dataRequest: "body",
};

export const URGENCY_META: Record<Urgency, { label: string; tone: StatusTone | "high" }> = {
  immediate: { label: "Immediate", tone: "urgent" },
  urgent: { label: "Urgent", tone: "high" },
  soon: { label: "Soon", tone: "waiting" },
  normal: { label: "Normal", tone: "closed" },
};
