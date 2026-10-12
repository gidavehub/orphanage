import "server-only";

// Support requests from /get-support/request (public-pages §3.6, data-model §4.2, §10; PLAN D79,
// D80, D94–D96, D107). runIntake (backend → form open? → honeypot + time trap → 5/hour, 20/day per
// IP hash → Turnstile when on → zod) then:
//   - immediate danger, or the child-protection category → written ONLY as a safeguarding concern
//     (source "moved_from_support"), with the same success screen (D79);
//   - otherwise one transaction: the request (explanation sealed), its timeline, attachments from
//     verified upload tokens, `support_confirmation` to the person (when they gave an email and said
//     it is safe to use), the in-app note and `staff_alert` emails for the support route, and audit.
// Upload files move out of quarantine after the commit.

import type { AttachmentLabel } from "@/lib/model/domain/case";
import type { SupportRequest } from "@/lib/model/domain/support";
import type { StaffProfile } from "@/lib/model/domain/staff";
import { SUPPORT_CATEGORY_PROGRAMME, type SupportCategory, type Uid } from "@/lib/model/enums";
import { SUPPORT_CATEGORY_LABEL, URGENCY3_LABEL } from "@/lib/model/labels";
import { adminHrefOfRef } from "@/lib/model/refs";
import { routes } from "@/lib/routes";
import { actionError, actionOk, type ActionResult, type FormState } from "@/lib/forms/types";
import { emailLowerOf } from "@/lib/schemas/common";
import { SUPPORT_ECHO_KEYS, supportSchema, type SupportData } from "@/lib/schemas/forms/support";
import { getFormsSettings } from "@/lib/server/public/settings";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import { docPath } from "@/lib/server/db/collections";
import type { Tx, WithId } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx, eventActorOf } from "@/lib/server/events";
import { createConcern } from "@/lib/server/intake/concern";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { attachmentWritesTx, moveAttachmentFiles, verifyUploadTokens, type AttachmentMove } from "@/lib/server/intake/upload";
import { activeStaff, notifyTx, recipientsFor } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";
import { sealField } from "@/lib/server/security/seal";
import { baseUrl } from "@/lib/server/url";

/** What the success screen needs. */
export type SupportSuccess = { emailSent: boolean };

export type SupportFormStatus = { open: boolean; counsellingOpen: boolean; closedMessage: string | null };

/** settings/forms (cached): lets staff pause the request form, or only counselling, without a deploy. */
export async function getSupportFormStatus(): Promise<SupportFormStatus> {
  try {
    const s = await getFormsSettings();
    return { open: s.supportOpen, counsellingOpen: s.counsellingOpen, closedMessage: s.closedMessage };
  } catch {
    return { open: true, counsellingOpen: true, closedMessage: null };
  }
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

/** Staff on a route who asked for instant inbox emails (admin-ux §8, `staff_alert`). */
export async function instantAlertUids(recipients: readonly Uid[]): Promise<Uid[]> {
  if (!recipients.length) return [];
  try {
    const staff: Array<WithId<StaffProfile>> = await activeStaff();
    const wanted = new Set(recipients);
    return staff
      .filter((s) => wanted.has(s.uid ?? s.id) && (s.notificationPrefs?.email?.inbox ?? "instant") === "instant")
      .map((s) => s.uid ?? s.id);
  } catch {
    return [];
  }
}

/** Queues the generic "something new for you" email (count and link only, D107). */
export async function staffAlertTx(tx: Tx, uids: readonly Uid[], reference: string, path: string): Promise<boolean> {
  if (!uids.length) return false;
  await enqueueEmailTx(tx, {
    template: "staff_alert",
    toStaffUids: [...uids],
    vars: { count: 1, link: `${baseUrl()}${routes.admin.record(reference)}` },
    dedupeKey: reference,
    related: { path, reference },
  });
  return true;
}

const LABEL_BY_CATEGORY: Record<SupportCategory, AttachmentLabel> = {
  education: "school_invoice",
  medical: "medical_report",
  legal: "legal_document",
  counselling: "other",
  food_supplies: "other",
  family_support: "other",
  other: "other",
};

function counsellingOf(d: SupportData): SupportRequest["counselling"] {
  if (d.category !== "counselling") return null;
  const forWhom = d.counsellingFor ?? "child";
  return {
    forWhom,
    ageBand: d.childAge ?? (forWhom === "parent_or_caregiver" ? "18+" : "unknown"),
    language: d.counsellingLanguage ?? "",
    format: d.counsellingVideo === "yes" ? "video" : d.counsellingVideo === "no" ? "phone" : "either",
    preferredDays: d.counsellingDays,
    preferredPeriods: d.counsellingPeriods,
    preferredTimes: d.counsellingTimes,
    timezone: d.timezone,
  };
}

function educationOf(d: SupportData): SupportRequest["education"] {
  if (d.category !== "education") return null;
  const amount = d.amountNeeded && d.amountNeededCurrency ? { amountMinor: d.amountNeeded, currency: d.amountNeededCurrency } : null;
  if (!d.educationLevel && d.educationNeeds.length === 0 && !amount) return null;
  return { level: d.educationLevel ?? "other", needs: d.educationNeeds, amountNeeded: amount };
}

/** D79: danger or child protection → a concern only, never a support request. */
async function routeToSafeguarding(d: SupportData, tokens: string[], loggedBy?: Viewer): Promise<{ reference: string; emailSent: boolean }> {
  const uploads = await verifyUploadTokens(tokens);
  const safe = d.safeToContact === "yes";
  const context = [
    loggedBy ? `Logged by ${loggedBy.displayName} from a call or visit (as a support request).` : `Sent through the Request Support form.`,
    `Type of support chosen: ${d.category === "child_protection" ? "Child protection concern" : SUPPORT_CATEGORY_LABEL[d.category]}.`,
    `Urgency: ${URGENCY3_LABEL[d.urgency]}. Immediate danger: ${d.immediateDanger === "yes" ? "Yes" : "No"}.`,
    safe ? null : "The person asked us to be careful when contacting them.",
  ]
    .filter(Boolean)
    .join(" ");
  return createConcern({
    source: loggedBy ? "staff_entry" : "moved_from_support",
    loggedBy,
    reporter: {
      anonymous: false,
      name: d.fullName,
      email: d.email,
      phone: d.phone,
      relationship: d.relationship,
      followUp: { method: d.preferredContact, times: d.bestTimes, notes: safe ? null : "Not safe to contact on these details without care." },
      // The support form's own consent: email chosen as the way to reach them, and safe to use (D108).
      emailConfirmationAllowed: d.preferredContact === "email" && safe,
    },
    child: { ageBand: d.childAge ?? "unknown", country: d.country, area: d.locality, details: null },
    concernTypes: ["other"],
    narrative: `${d.explanation}\n\n${context}`,
    inDangerNow: d.immediateDanger === "yes" ? "yes" : "unsure",
    authoritiesContacted: "unsure",
    authorityDetails: null,
    suspectedSpam: false,
    uploads,
    createdSummary: loggedBy ? `Logged by ${loggedBy.displayName} from a call or visit` : "Moved here from the Request Support form",
  });
}

async function createSupportRequest(d: SupportData & { category: SupportCategory }, loggedBy?: Viewer): Promise<{ reference: string; emailSent: boolean }> {
  const programmeId = SUPPORT_CATEGORY_PROGRAMME[d.category];
  const [uploads, recipients] = await Promise.all([verifyUploadTokens(d.upload), recipientsFor("support_new", { programmeId })]);
  const alertUids = await instantAlertUids(recipients);
  const email = d.email;
  const emailLower = email ? emailLowerOf(email) : null;
  const sendConfirmation = !!email && d.safeToContact === "yes";
  const firstName = firstNameOf(d.fullName);

  let moves: AttachmentMove[] = [];
  const reference = await createWithReference<SupportRequest>(
    "supportRequests",
    (ref, now) => {
      const path = docPath("supportRequests", ref);
      const child = d.childAge || d.childrenCount ? { ageBand: d.childAge ?? "unknown", numberOfChildren: d.childrenCount } : null;
      return {
        reference: ref,
        status: "new",
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
        searchTokens: buildSearchTokens({ reference: ref, email, names: [d.fullName], phone: d.phone }),
        retention: { policy: "support.unsupported", retainUntil: null, legalHold: false },
        source: loggedBy ? "staff_entry" : "web_form",
        createdAt: now,
        updatedAt: now,
        version: 1,
        category: d.category,
        programmeId,
        applicant: {
          fullName: d.fullName,
          relationship: d.relationship,
          relationshipOther: d.relationship === "other" ? d.relationshipOther : null,
          email,
          emailLower,
          phone: d.phone,
          country: d.country,
          locality: d.locality,
          preferredContact: d.preferredContact,
          safeToContact: d.safeToContact === "yes",
          bestTimes: d.bestTimes,
        },
        child,
        explanation: sealField(path, "explanation", d.explanation),
        urgency: d.urgency,
        immediateDanger: false,
        consentToContact: consentStamp(now),
        privacyAcknowledged: consentStamp(now),
        counselling: counsellingOf(d),
        education: educationOf(d),
        medical: d.category === "medical" && d.medicalNeed ? { need: d.medicalNeed } : null,
        legal: d.category === "legal" && d.legalMatter ? { matter: d.legalMatter } : null,
        food:
          d.category === "food_supplies" && (d.householdSize !== null || d.childrenInHousehold !== null)
            ? { householdSize: d.householdSize, childrenInHousehold: d.childrenInHousehold }
            : null,
        triage: { eligibility: null, verification: { status: "not_started", method: null, by: null, at: null } },
        moreInfo: null,
        referrals: [],
        decision: null,
        outcome: null,
        closureReason: null,
        linkedConcernRef: null,
        attachmentCount: uploads.length,
      };
    },
    async (tx, ref, now) => {
      const path = docPath("supportRequests", ref);
      addEventTx(tx, path, {
        type: "created",
        actor: loggedBy ? eventActorOf(loggedBy) : { kind: "public" },
        summary: loggedBy
          ? `Logged by ${loggedBy.displayName} from a call or visit`
          : d.category === "counselling"
            ? "Counselling request received through the website"
            : "Request received through the website",
        at: now,
      });
      if (uploads.length) {
        moves = attachmentWritesTx(tx, uploads, { collection: "supportRequests", docId: ref, label: LABEL_BY_CATEGORY[d.category], now });
        addEventTx(tx, path, {
          type: "attachment_added",
          actor: { kind: "public" },
          summary: uploads.length === 1 ? "1 document attached" : `${uploads.length} documents attached`,
          at: now,
        });
      }
      if (sendConfirmation && email) {
        await enqueueEmailTx(tx, {
          template: "support_confirmation",
          to: [email],
          vars: { reference: ref, ...(firstName ? { firstName } : {}) },
          related: { path, reference: ref },
        });
        addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Confirmation email queued", at: now });
      }
      const others = recipients.filter((u) => u !== loggedBy?.uid);
      if (others.length) {
        notifyTx(tx, { recipientUids: others, kind: "new_case", title: `New support request ${ref}`, href: adminHrefOfRef(ref, "support") });
      }
      await staffAlertTx(tx, alertUids.filter((u) => u !== loggedBy?.uid), ref, path);
      auditTx(tx, {
        actor: loggedBy ? actorOf(loggedBy) : { kind: "public" },
        action: loggedBy ? "support.logged" : "support.received",
        area: "support",
        summary: loggedBy ? `${loggedBy.displayName} logged a support request from a call or visit (${ref})` : `A support request was received on the website (${ref})`,
        feed: true,
        targetPath: path,
        targetRef: ref,
      });
    },
  );

  if (moves.length) await moveAttachmentFiles(moves);
  return { reference, emailSent: sendConfirmation };
}

/** The request form's Server Action body. */
export async function submitSupportForm(fd: FormData): Promise<FormState<string, SupportSuccess>> {
  return runIntake<typeof supportSchema, SupportSuccess>({
    form: "support",
    input: fd,
    schema: supportSchema,
    echoKeys: SUPPORT_ECHO_KEYS,
    isOpen: async () => {
      const s = await getSupportFormStatus();
      return s.open ? true : (s.closedMessage ?? false);
    },
    rateLimitedMessage: "You've sent several requests in a short time. Please wait a few minutes and try again, or call or email us.",
    create: async (data) => {
      const result =
        data.category === "child_protection" || data.immediateDanger === "yes"
          ? await routeToSafeguarding(data, data.upload)
          : await createSupportRequest(data as SupportData & { category: SupportCategory });
      return { reference: result.reference, data: { emailSent: result.emailSent } };
    },
  });
}

/**
 * A team member logs a request from a call or visit (admin-ux §3.4 "Log a request"): the same checks
 * and record as the website form (source `staff_entry`, the timeline names them), and the same D79
 * rule: danger or child protection becomes a safeguarding concern only. The staff member confirms the
 * person agreed to us keeping their details and contacting them.
 */
export async function logSupportByStaff(v: Viewer, raw: Record<string, unknown>): Promise<ActionResult<{ reference: string; concern: boolean }>> {
  if (raw.agreed !== true) return actionError({ kind: "validation", fields: { agreed: "Please confirm they agreed to us keeping their details and contacting them." } });
  const input: Record<string, unknown> = { ...raw, upload: [], consentToContact: "on", privacyAcknowledged: "on" };
  delete input.agreed;
  const parsed = supportSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "_form");
      if (!fields[k]) fields[k] = i.message;
    }
    return actionError({ kind: "validation", fields });
  }
  const d = parsed.data;
  const concern = d.category === "child_protection" || d.immediateDanger === "yes";
  const r = concern ? await routeToSafeguarding(d, [], v) : await createSupportRequest(d as SupportData & { category: SupportCategory }, v);
  return actionOk({ reference: r.reference, concern });
}
