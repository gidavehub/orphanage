import "server-only";

// The partnership enquiry intake (public-pages §3.18, data-model §4.4). One transaction:
//   partnershipEnquiries/{HVN-PE-YYYY-NNNN} (status `new`) + a "created" timeline event +
//   partnership_acknowledgement + a "New partnership enquiry" notification + an audit entry.

import type { FormState } from "@/lib/forms/types";
import type { PartnershipEnquiry } from "@/lib/model/domain/engagement";
import type { Millis } from "@/lib/model/enums";
import { PARTNERSHIP_TYPE_LABEL } from "@/lib/model/labels";
import { adminHrefOfRef } from "@/lib/model/refs";
import { emailLowerOf } from "@/lib/schemas/common";
import { PARTNERSHIP_ECHO_KEYS, partnershipSchema, type PartnershipData, type PartnershipField } from "@/lib/schemas/forms/partnership";
import { auditTx } from "@/lib/server/audit";
import { docPath } from "@/lib/server/db/collections";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { caseBase, firstNameOf } from "@/lib/server/intake/caseBase";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";

function buildEnquiry(reference: string, now: Millis, d: PartnershipData): PartnershipEnquiry {
  const emailLower = emailLowerOf(d.email);
  return {
    ...caseBase(reference, "new", now, "partnership", { email: emailLower, names: [d.contactName, d.orgName], phone: d.phone }),
    organisation: { name: d.orgName, kind: d.orgKind, website: d.website, country: d.country },
    contact: { fullName: d.contactName, role: d.role, email: d.email, emailLower, phone: d.phone },
    partnershipType: d.partnershipType,
    programmeId: d.programme,
    message: d.message,
    heardFrom: d.heardFrom,
    consentToContact: consentStamp(now),
  };
}

export async function submitPartnership(fd: FormData): Promise<FormState<PartnershipField>> {
  return runIntake({
    form: "partnership",
    input: fd,
    schema: partnershipSchema,
    echoKeys: PARTNERSHIP_ECHO_KEYS,
    create: async (d) => {
      const recipients = await recipientsFor("partnership_new");
      const reference = await createWithReference<PartnershipEnquiry>(
        "partnershipEnquiries",
        (ref, now) => buildEnquiry(ref, now, d),
        async (tx, ref, now) => {
          const path = docPath("partnershipEnquiries", ref);
          addEventTx(tx, path, {
            type: "created",
            actor: { kind: "public" },
            summary: `Partnership enquiry (${PARTNERSHIP_TYPE_LABEL[d.partnershipType].toLowerCase()}) sent through the website`,
            at: now,
          });
          await enqueueEmailTx(tx, {
            template: "partnership_acknowledgement",
            to: [d.email],
            vars: { reference: ref, firstName: firstNameOf(d.contactName) },
            related: { path, reference: ref },
          });
          addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Partnership acknowledgement email queued", at: now });
          if (recipients.length) {
            notifyTx(tx, { recipientUids: recipients, kind: "new_case", title: `New partnership enquiry ${ref}`, href: adminHrefOfRef(ref, "partner") });
          }
          auditTx(tx, {
            actor: { kind: "public" },
            action: "partnership.enquire",
            area: "engagement",
            summary: `A partnership enquiry was sent on the website (${ref})`,
            feed: true,
            targetPath: path,
            targetRef: ref,
          });
        },
      );
      return { reference };
    },
  }) as Promise<FormState<PartnershipField>>;
}
