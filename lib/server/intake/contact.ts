import "server-only";

// Contact messages from /contact (public-pages §3.8, data-model §4.4, §10; PLAN D81, D104, D107).
// runIntake (backend → honeypot + time trap → 5 per hour per IP hash → Turnstile when on → zod), then
// one transaction: the message (HVN-CM-YYYY-NNNN), its timeline, `contact_confirmation` to the sender,
// the in-app note for the category's owners and `staff_alert` emails, and audit. Child-protection
// reports never come through here: the form swaps itself for the safeguarding redirect.

import type { ContactMessage } from "@/lib/model/domain/engagement";
import { programmeIdOfSlug } from "@/lib/model/enums";
import { adminHrefOfRef } from "@/lib/model/refs";
import type { FormState } from "@/lib/forms/types";
import { emailLowerOf } from "@/lib/schemas/common";
import { CONTACT_ECHO_KEYS, contactSchema, type ContactData } from "@/lib/schemas/forms/contact";
import { auditTx } from "@/lib/server/audit";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import { docPath } from "@/lib/server/db/collections";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { firstNameOf, instantAlertUids, staffAlertTx } from "@/lib/server/intake/support";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";

export type ContactSuccess = { firstName: string | null };

async function createContactMessage(d: ContactData): Promise<string> {
  const programmeId = d.category === "programme_info" && d.programme ? programmeIdOfSlug(d.programme) : null;
  const recipients = await recipientsFor("contact_new", { contactCategory: d.category, programmeId });
  const alertUids = await instantAlertUids(recipients);
  const firstName = firstNameOf(d.fullName);

  return createWithReference<ContactMessage>(
    "contactMessages",
    (ref, now) => ({
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
      searchTokens: buildSearchTokens({ reference: ref, email: d.email, names: [d.fullName], phone: d.phone }),
      retention: { policy: "contact", retainUntil: null, legalHold: false },
      source: "web_form",
      createdAt: now,
      updatedAt: now,
      version: 1,
      fullName: d.fullName,
      email: d.email,
      emailLower: emailLowerOf(d.email),
      phone: d.phone,
      country: d.country,
      subject: d.subject,
      category: d.category,
      programmeId,
      message: d.message,
      consent: consentStamp(now),
      replies: [],
      linkedConcernRef: null,
    }),
    async (tx, ref, now) => {
      const path = docPath("contactMessages", ref);
      addEventTx(tx, path, { type: "created", actor: { kind: "public" }, summary: "Message received through the website", at: now });
      await enqueueEmailTx(tx, {
        template: "contact_confirmation",
        to: [d.email],
        vars: { reference: ref, ...(firstName ? { firstName } : {}) },
        related: { path, reference: ref },
      });
      addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Confirmation email queued", at: now });
      if (recipients.length) {
        notifyTx(tx, { recipientUids: recipients, kind: "new_case", title: `New message ${ref}`, href: adminHrefOfRef(ref, "message") });
      }
      await staffAlertTx(tx, alertUids, ref, path);
      auditTx(tx, {
        actor: { kind: "public" },
        action: "contact.received",
        area: "engagement",
        summary: `A message was received on the website (${ref})`,
        feed: true,
        targetPath: path,
        targetRef: ref,
      });
    },
  );
}

/** The contact form's Server Action body. */
export async function submitContactForm(fd: FormData): Promise<FormState<string, ContactSuccess>> {
  return runIntake<typeof contactSchema, ContactSuccess>({
    form: "contact",
    input: fd,
    schema: contactSchema,
    echoKeys: CONTACT_ECHO_KEYS,
    rateLimitedMessage: "You've sent several messages in a short time. Please wait a few minutes and try again, or email us directly.",
    create: async (data) => {
      const reference = await createContactMessage(data);
      return { reference, data: { firstName: firstNameOf(data.fullName) } };
    },
  });
}
