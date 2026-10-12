import "server-only";

// Messages and story submissions for the team space (admin-ux §6.19; PLAN D58). Each entry point
// calls requireStaff first and opens the record for the viewer (contact categories included).
// "Turn into a support request" creates an HVN-SR record from a message (the message text becomes
// the sealed explanation) and links both; "Turn into a testimonial" creates a draft testimonial with
// consent "missing", which the website gate keeps off the site until consent is recorded.

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { writeItem } from "@/lib/content/store";
import type { ContactMessage, StorySubmission } from "@/lib/model/domain/engagement";
import type { SupportRequest } from "@/lib/model/domain/support";
import { toStaffRef, type StaffRef, type TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis, SupportCategory } from "@/lib/model/enums";
import { CONTACT_CATEGORY_LABEL, STORY_SUBMITTER_ROLE_LABEL } from "@/lib/model/labels";
import type { StatusOf } from "@/lib/model/status";
import { SUPPORT_CATEGORY_PROGRAMME } from "@/lib/model/enums";
import { actorOf, audit, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { addEventTx, addNoteTx, eventActorOf, listEvents, listNotes, openNoteBody } from "@/lib/server/events";
import { caseBase } from "@/lib/server/intake/caseBase";
import { consentStamp } from "@/lib/server/intake/pipeline";
import { log } from "@/lib/server/log";
import { createWithReference } from "@/lib/server/references";
import { sealField, tryOpenField } from "@/lib/server/security/seal";
import { contactMachine, storyMachine } from "@/lib/server/workflow/engagement";
import { loadForViewer, maskEmail, maskPhone, staffRefs } from "./_shared";

/* ── Messages ──────────────────────────────────────────────────────────── */

export type MessageDetailDTO = {
  ref: string;
  status: StatusOf<"contact">;
  version: number;
  createdAt: Millis;
  category: string;
  subject: string;
  message: string;
  name: string;
  country: string;
  email: { value: string; masked: boolean };
  phone: { value: string; masked: boolean } | null;
  canReveal: boolean;
  canWrite: boolean;
  edges: string[];
  assignee: StaffRef | null;
  replies: Array<{ at: Millis; byName: string }>;
  history: Array<{ status: StatusOf<"contact">; at: Millis }>;
};

export async function getMessageDetail(ref: string): Promise<MessageDetailDTO> {
  const v = await requireStaff("contact.read", "contact.manage");
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "contactMessages") throw new Error("Not a message.");
  const m = loaded.record as unknown as ContactMessage;
  const canWrite = has(v, "contact.manage");
  const seeContact = m.assignedTo === v.uid || v.roles.includes("super_admin");
  const [staff, events] = await Promise.all([staffRefs(), listEvents(loaded.path, { limit: 50 })]);
  const history: MessageDetailDTO["history"] = [{ status: "new", at: m.createdAt }];
  for (const e of [...events.items].reverse()) if (e.type === "status_changed" && e.to) history.push({ status: e.to as StatusOf<"contact">, at: e.at });
  return {
    ref: loaded.ref,
    status: m.status,
    version: m.version,
    createdAt: m.createdAt,
    category: CONTACT_CATEGORY_LABEL[m.category] ?? m.category,
    subject: m.subject,
    message: m.message,
    name: m.fullName,
    country: m.country,
    email: seeContact ? { value: m.email, masked: false } : { value: maskEmail(m.email), masked: true },
    phone: m.phone ? (seeContact ? { value: m.phone, masked: false } : { value: maskPhone(m.phone), masked: true }) : null,
    canReveal: !v.roles.every((r) => r === "viewer"),
    canWrite,
    edges: canWrite ? contactMachine.allowedFor({ status: m.status }, v).map((e) => e.id) : [],
    assignee: m.assignedTo ? (staff.get(m.assignedTo) ?? toStaffRef(m.assignedTo, m.assignedName ?? "A colleague")) : null,
    replies: (m.replies ?? []).map((r) => ({ at: r.at, byName: r.byName })),
    history,
  };
}

export async function revealMessageContact(ref: string, field: "phone" | "email"): Promise<string | null> {
  const v = await requireStaff("contact.read", "contact.manage");
  if (v.roles.every((r) => r === "viewer")) return null;
  const loaded = await loadForViewer(v, ref);
  const m = loaded.record as unknown as ContactMessage;
  const value = field === "phone" ? m.phone : m.email;
  if (!value) return null;
  await audit({ actor: actorOf(v), action: "record.reveal", area: "engagement", summary: `${v.displayName.split(" ")[0]} viewed the ${field} on ${loaded.ref}`, feed: false, sensitive: true, targetPath: loaded.path, targetRef: loaded.ref });
  return value;
}

/** Creates a support request from a message and links both (the message is closed with a note). */
export async function messageToSupport(ref: string, category: SupportCategory): Promise<ActionResult<{ ref: string }>> {
  const v = await requireStaff("contact.manage");
  if (!has(v, "support.manage")) return actionError({ kind: "forbidden", message: "Creating support requests isn't open to your role. Hand it to a programme officer." });
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "contactMessages") return actionError({ kind: "not_allowed", message: "That isn't a message." });
  const m = loaded.record as unknown as ContactMessage;
  try {
    const newRef = await createWithReference<SupportRequest>(
      "supportRequests",
      (sr, now) => {
        const emailLower = m.email.toLowerCase();
        return {
          ...caseBase(sr, "under_review", now, "support.unsupported", { email: emailLower, names: [m.fullName], phone: m.phone }),
          source: "staff_entry",
          assignedTo: v.uid,
          assignedName: v.displayName,
          assignedAt: now,
          category,
          programmeId: SUPPORT_CATEGORY_PROGRAMME[category],
          applicant: {
            fullName: m.fullName,
            relationship: "other",
            relationshipOther: "Wrote through the contact form",
            email: m.email,
            emailLower,
            phone: m.phone,
            country: m.country,
            locality: null,
            preferredContact: m.phone ? "phone" : "email",
            safeToContact: true,
            bestTimes: null,
          },
          child: null,
          explanation: sealField(docPath("supportRequests", sr), "explanation", `${m.subject}\n\n${m.message}`.slice(0, 2000)),
          urgency: "medium",
          immediateDanger: false,
          consentToContact: m.consent ?? consentStamp(now),
          privacyAcknowledged: m.consent ?? consentStamp(now),
          counselling: null,
          education: null,
          medical: null,
          legal: null,
          food: null,
          triage: { eligibility: null, verification: { status: "not_started", method: null, by: null, at: null } },
          moreInfo: null,
          referrals: [],
          decision: null,
          outcome: null,
          closureReason: null,
          linkedConcernRef: null,
          attachmentCount: 0,
        } as SupportRequest;
      },
      async (tx, sr, now) => {
        const msg = await tx.get<ContactMessage>(loaded.path);
        if (!msg) throw new Error("The message is gone.");
        addEventTx(tx, docPath("supportRequests", sr), { type: "created", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} created this from message ${loaded.ref}`, at: now });
        addNoteTx(tx, loaded.path, { kind: "note", body: `Turned into support request ${sr}.`, author: { uid: v.uid, name: v.displayName } });
        tx.update(loaded.path, { status: "closed", statusChangedAt: now, closedAt: now, lastActivityAt: now, updatedAt: now, version: msg.version + 1 });
        auditTx(tx, { actor: actorOf(v), action: "record.create", area: "support", summary: `${v.displayName} turned ${loaded.ref} into ${sr}`, feed: true, targetPath: docPath("supportRequests", sr), targetRef: sr });
      },
    );
    return actionOk({ ref: newRef });
  } catch (err) {
    log.warn("dal.message_to_support_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't work. Please try again." });
  }
}

/* ── Story submissions ─────────────────────────────────────────────────── */

export type StoryDetailDTO = {
  ref: string;
  status: StatusOf<"storySubmission">;
  version: number;
  createdAt: Millis;
  role: string;
  roleId: StorySubmission["submitterRole"];
  displayName: string | null;
  publishWithoutName: boolean;
  country: string;
  programmeId: string | null;
  story: string;
  contact: { name: string | null; email: string | null; phone: string | null } | null;
  parentOrGuardian: boolean;
  createdItem: StorySubmission["createdItem"];
  declineReason: string | null;
  canWrite: boolean;
  edges: string[];
  history: Array<{ status: StatusOf<"storySubmission">; at: Millis }>;
};

export async function getStoryDetail(ref: string): Promise<StoryDetailDTO> {
  const v = await requireStaff("storySubmission.manage");
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "storySubmissions") throw new Error("Not a story submission.");
  const s = loaded.record as unknown as StorySubmission;
  const events = await listEvents(loaded.path, { limit: 50 });
  const history: StoryDetailDTO["history"] = [{ status: "new", at: s.createdAt }];
  for (const e of [...events.items].reverse()) if (e.type === "status_changed" && e.to) history.push({ status: e.to as StatusOf<"storySubmission">, at: e.at });
  const contact = tryOpenField<{ name?: string; email?: string | null; phone?: string | null }>(loaded.path, "contact", s.contact);
  return {
    ref: loaded.ref,
    status: s.status,
    version: s.version,
    createdAt: s.createdAt,
    role: STORY_SUBMITTER_ROLE_LABEL[s.submitterRole] ?? s.submitterRole,
    roleId: s.submitterRole,
    displayName: s.displayName,
    publishWithoutName: s.publishWithoutName,
    country: s.country,
    programmeId: s.programmeId,
    story: s.story,
    contact: contact ? { name: contact.name ?? null, email: contact.email ?? null, phone: contact.phone ?? null } : null,
    parentOrGuardian: s.parentOrGuardian,
    createdItem: s.createdItem,
    declineReason: s.declineReason,
    canWrite: true,
    edges: storyMachine.allowedFor({ status: s.status }, v).map((e) => e.id),
    history,
  };
}

const ROLE_WORD: Record<StorySubmission["submitterRole"], string> = {
  beneficiary: "Parent",
  donor: "Donor",
  volunteer: "Volunteer",
  partner: "Partner",
  professional: "Professional",
};

/** Turns a story submission into a draft testimonial (consent "missing" until recorded). */
export async function storyToTestimonial(ref: string, quote: string): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("storySubmission.manage");
  if (!has(v, "content.edit")) return actionError({ kind: "forbidden", message: "Editing the website isn't open to your role." });
  const loaded = await loadForViewer(v, ref);
  const s = loaded.record as unknown as StorySubmission;
  if (s.createdItem) return actionError({ kind: "not_allowed", message: "A draft was already made from this story." });
  const text = quote.trim();
  if (text.length < 20 || text.length > 280) return actionError({ kind: "validation", fields: { quote: "Keep the quote between 20 and 280 characters." } });
  const name = s.publishWithoutName || !s.displayName ? ROLE_WORD[s.submitterRole] : s.displayName.split(/\s+/).map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(" ");
  const out = await writeItem(v, {
    collection: "testimonials",
    data: { name: name.slice(0, 40), kind: s.submitterRole, role: (STORY_SUBMITTER_ROLE_LABEL[s.submitterRole] ?? "").slice(0, 60), quote: text, consent: { state: "missing" } },
    intent: "draft",
  });
  if (!out.result.ok) return actionError({ kind: "not_allowed", message: "The draft couldn't be created. Please try again." });
  const id = out.result.data.id;
  const now = Date.now();
  try {
    await getStore().runTransaction(async (tx) => {
      const rec = await tx.get<StorySubmission>(loaded.path);
      if (!rec) return;
      tx.update(loaded.path, { createdItem: { collection: "testimonials", id }, lastActivityAt: now, updatedAt: now, version: rec.version + 1 });
      addEventTx(tx, loaded.path, { type: "field_updated", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} made a draft testimonial from this story`, at: now });
    });
  } catch (err) {
    log.warn("dal.story_link_failed", { ref, err });
  }
  return actionOk({ id });
}

/** Notes and events for a message or story, newest first (opened after the permission check). */
export async function getEngagementTimeline(ref: string): Promise<TimelineEntryDTO[]> {
  const v = await requireStaff("contact.read", "contact.manage", "storySubmission.manage");
  const loaded = await loadForViewer(v, ref);
  const [events, notes] = await Promise.all([listEvents(loaded.path, { limit: 50 }), listNotes(loaded.path, { limit: 50 })]);
  const out: TimelineEntryDTO[] = events.items
    .filter((e) => e.type !== "note_added")
    .map((e) => ({
      id: e.id,
      ref: loaded.ref,
      at: e.at,
      actor: e.actor.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : e.actor.kind === "system" ? { system: e.actor.job } : { public: true as const },
      kind: e.type === "created" ? "submitted" : e.type === "status_changed" ? "status" : e.type.startsWith("email") ? "email" : "system",
      text: e.summary,
    }));
  for (const n of notes.items) {
    if (n.deletedAt) continue;
    let text = "";
    try {
      text = openNoteBody(loaded.path, n);
    } catch {
      text = "This note couldn't be opened.";
    }
    out.push({ id: `note-${n.id}`, ref: loaded.ref, at: n.createdAt, actor: toStaffRef(n.authorUid, n.authorName), kind: "note", text: n.kind === "call" ? `Call: ${text}` : text });
  }
  return out.sort((a, b) => b.at - a.at);
}
