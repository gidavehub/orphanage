import "server-only";

// People › Partners (admin-ux §6.9; PLAN D78). The board of partnership enquiries by stage (New ·
// Under review · Talking · Agreement · Active; Closed and Declined rest in the tray) and the record:
// the organisation, its contact, what they propose, follow-up, timeline and notes.

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { PartnershipEnquiry } from "@/lib/model/domain/engagement";
import { toStaffRef, type StaffRef } from "@/lib/model/dto";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis, Uid } from "@/lib/model/enums";
import { HEARD_FROM_LABEL, PARTNER_KIND_LABEL, PARTNERSHIP_TYPE_LABEL, PROGRAMME_LABEL } from "@/lib/model/labels";
import type { StatusOf } from "@/lib/model/status";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import type { WithId } from "@/lib/server/db/store";
import { addEventTx, eventActorOf } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { transitionResult } from "@/lib/server/workflow/flow";
import { partnershipMachine } from "@/lib/server/workflow/partnership";
import type { PeopleInput } from "@/lib/server/workflow/volunteer";
import { loadForViewer } from "./_shared";
import { listBoard, shortName, type BoardDTO } from "./volunteers";

const DAY = 86_400_000;
const STATUSES = ["new", "under_review", "in_discussion", "agreed", "active", "declined", "closed"] as const;

export async function getPartnerBoard(): Promise<BoardDTO> {
  const v = await requireStaff("partnership.read", "partnership.summary", "partnership.manage");
  const summaryOnly = !hasAny(v, "partnership.read", "partnership.manage");
  const now = Date.now();
  let rows: Array<WithId<PartnershipEnquiry>> = [];
  try {
    rows = await listBoard<PartnershipEnquiry>(v, "partnershipEnquiries", STATUSES);
  } catch (err) {
    log.warn("dal.partnerships.board_failed", { err });
  }
  return {
    summaryOnly,
    canManage: has(v, "partnership.manage"),
    interests: Object.entries(PARTNERSHIP_TYPE_LABEL).map(([value, label]) => ({ value, label })),
    cards: rows.map((r) => ({
      ref: r.reference ?? r.id,
      version: r.version,
      status: r.status,
      title: r.organisation.name,
      subtitle: summaryOnly ? (PARTNER_KIND_LABEL[r.organisation.kind] ?? null) : `${PARTNER_KIND_LABEL[r.organisation.kind] ?? r.organisation.kind} · ${shortName(r.contact.fullName)}`,
      country: r.organisation.country,
      chips: [PARTNERSHIP_TYPE_LABEL[r.partnershipType] ?? r.partnershipType],
      moreChips: 0,
      daysInStage: Math.max(0, Math.floor((now - (r.statusChangedAt ?? r.createdAt)) / DAY)),
      followUp: r.assignedTo && r.assignedName ? toStaffRef(r.assignedTo, r.assignedName) : null,
      ready: null,
      interests: [r.partnershipType],
    })),
  };
}

export type PartnerDetailDTO = {
  ref: string;
  version: number;
  status: StatusOf<"partnership">;
  organisation: { name: string; kind: string; website: string | null; country: string };
  contact: { name: string; role: string | null; email: string; phone: string | null };
  type: string;
  programme: string | null;
  message: string;
  heardFrom: string | null;
  consentToContact: boolean;
  followUp: { person: StaffRef | null; at: Millis | null };
  createdAt: Millis;
  edges: Array<EdgeSpec<StatusOf<"partnership">>>;
  people: Array<{ uid: Uid; name: string }>;
  canManage: boolean;
};

async function managers(): Promise<Array<{ uid: Uid; name: string }>> {
  const staff = await activeStaff();
  return staff.filter((s) => (s.roles ?? []).some((r) => r === "programme_officer" || r === "super_admin")).map((s) => ({ uid: s.uid ?? s.id, name: s.displayName }));
}

export async function getPartner(ref: string): Promise<PartnerDetailDTO> {
  const v = await requireStaff("partnership.read", "partnership.manage");
  const loaded = await loadForViewer(v, ref);
  const r = loaded.record as unknown as WithId<PartnershipEnquiry>;
  return {
    ref: loaded.ref,
    version: r.version,
    status: r.status,
    organisation: { name: r.organisation.name, kind: PARTNER_KIND_LABEL[r.organisation.kind] ?? r.organisation.kind, website: r.organisation.website, country: r.organisation.country },
    contact: { name: r.contact.fullName, role: r.contact.role, email: r.contact.email, phone: r.contact.phone },
    type: PARTNERSHIP_TYPE_LABEL[r.partnershipType] ?? r.partnershipType,
    programme: r.programmeId ? PROGRAMME_LABEL[r.programmeId] : null,
    message: r.message,
    heardFrom: r.heardFrom ? (HEARD_FROM_LABEL[r.heardFrom] ?? r.heardFrom) : null,
    consentToContact: Boolean(r.consentToContact),
    followUp: { person: r.assignedTo && r.assignedName ? toStaffRef(r.assignedTo, r.assignedName) : null, at: r.followUpAt },
    createdAt: r.createdAt,
    edges: partnershipMachine.allowedFor(r, v),
    people: await managers(),
    canManage: has(v, "partnership.manage"),
  };
}

export async function movePartner(ref: string, edgeId: string, expectedVersion: number, input: PeopleInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("partnership.manage");
  const clean: PeopleInput = typeof input.reason === "string" ? { reason: input.reason.slice(0, 500) } : {};
  return (await transitionResult(() => partnershipMachine.transition({ ref, edgeId, actor: v, expectedVersion, input: clean }))) as ActionResult<{ version: number; at: Millis; status: string }>;
}

export async function setPartnerFollowUp(ref: string, expectedVersion: number, uid: Uid | null, at: Millis | null): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("partnership.manage");
  const people = await managers();
  const person = uid ? people.find((p) => p.uid === uid) : null;
  if (uid && !person) return actionError({ kind: "validation", fields: { followUp: "Choose someone from the team." } });
  const loaded = await loadForViewer(v, ref);
  try {
    const out = await getStore().runTransaction(async (tx) => {
      const r = await tx.get<PartnershipEnquiry>(loaded.path);
      if (!r) return null;
      if (r.version !== expectedVersion) return { conflict: r };
      const now = Date.now();
      const version = r.version + 1;
      const summary = person ? `${v.displayName.split(" ")[0]} asked ${person.name.split(" ")[0]} to follow up` : `${v.displayName.split(" ")[0]} cleared the follow-up`;
      tx.update(loaded.path, { assignedTo: person?.uid ?? null, assignedName: person?.name ?? null, assignedAt: person ? now : null, followUpAt: at, version, updatedAt: now, lastActivityAt: now });
      addEventTx(tx, loaded.path, { type: person ? "assigned" : "unassigned", actor: eventActorOf(v), summary, at: now });
      auditTx(tx, { actor: actorOf(v), action: "record.update", area: "engagement", summary, targetRef: loaded.ref });
      return { version };
    });
    if (!out) return actionError({ kind: "not_allowed", message: "This enquiry no longer exists." });
    if ("conflict" in out && out.conflict) return actionError({ kind: "conflict", message: "Someone else changed this. Reload to see their changes.", current: { version: out.conflict.version, updatedBy: "", updatedAt: out.conflict.updatedAt } });
    return actionOk({ version: (out as { version: number }).version });
  } catch (err) {
    log.error("dal.partnerships.followup_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}
