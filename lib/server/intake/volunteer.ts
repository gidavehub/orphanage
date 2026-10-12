import "server-only";

// The volunteer application intake (public-pages §3.17, data-model §4.4). One transaction:
//   volunteerApplications/{HVN-VA-YYYY-NNNN} (status `submitted`, consent stamps, the onboarding
//   checklist empty until approval) + a "created" timeline event + volunteer_acknowledgement + a
//   "New volunteer application" notification for programme officers + an audit entry.
// The pipeline in front handles the backend check, honeypot and time trap, the per-IP-hash limit
// (5 an hour) and the optional Turnstile.

import type { FormState } from "@/lib/forms/types";
import type { VolunteerApplication } from "@/lib/model/domain/engagement";
import type { Millis } from "@/lib/model/enums";
import { adminHrefOfRef } from "@/lib/model/refs";
import { emailLowerOf } from "@/lib/schemas/common";
import { VOLUNTEER_ECHO_KEYS, volunteerSchema, type VolunteerData, type VolunteerField } from "@/lib/schemas/forms/volunteer";
import { auditTx } from "@/lib/server/audit";
import { docPath } from "@/lib/server/db/collections";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { caseBase, firstNameOf } from "@/lib/server/intake/caseBase";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";

function buildApplication(reference: string, now: Millis, d: VolunteerData): VolunteerApplication {
  const emailLower = emailLowerOf(d.email);
  const stamp = consentStamp(now);
  return {
    ...caseBase(reference, "submitted", now, "volunteer.former", { email: emailLower, names: [d.fullName], phone: d.phone }),
    applicant: { fullName: d.fullName, email: d.email, emailLower, phone: d.phone, country: d.country, locality: d.locality },
    isAdult: true,
    interests: d.interests,
    skills: d.skills,
    languages: d.languages,
    availability: { hoursPerWeek: d.hours, mode: d.mode, days: d.days },
    motivation: d.motivation,
    workedWithChildren: d.workedWithChildren === "yes",
    workedWithChildrenNote: d.workedWithChildren === "yes" ? d.workedWithChildrenNote : null,
    backgroundCheckConsent: true,
    safeguardingCheck: null,
    interview: null,
    heardFrom: d.heardFrom,
    onboardingChecklist: [],
    consentToContact: stamp,
    privacyAcknowledged: stamp,
    safeguardingAcknowledged: stamp,
    declineReasonCode: null,
  };
}

export async function submitVolunteer(fd: FormData): Promise<FormState<VolunteerField>> {
  return runIntake({
    form: "volunteer",
    input: fd,
    schema: volunteerSchema,
    echoKeys: VOLUNTEER_ECHO_KEYS,
    create: async (d) => {
      const recipients = await recipientsFor("volunteer_new");
      const reference = await createWithReference<VolunteerApplication>(
        "volunteerApplications",
        (ref, now) => buildApplication(ref, now, d),
        async (tx, ref, now) => {
          const path = docPath("volunteerApplications", ref);
          addEventTx(tx, path, { type: "created", actor: { kind: "public" }, summary: "Volunteer application sent through the website", at: now });
          await enqueueEmailTx(tx, {
            template: "volunteer_acknowledgement",
            to: [d.email],
            vars: { reference: ref, firstName: firstNameOf(d.fullName) },
            related: { path, reference: ref },
          });
          addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Volunteer acknowledgement email queued", at: now });
          if (recipients.length) {
            notifyTx(tx, { recipientUids: recipients, kind: "new_case", title: `New volunteer application ${ref}`, href: adminHrefOfRef(ref, "volunteer") });
          }
          auditTx(tx, {
            actor: { kind: "public" },
            action: "volunteer.apply",
            area: "engagement",
            summary: `A volunteer application was sent on the website (${ref})`,
            feed: true,
            targetPath: path,
            targetRef: ref,
          });
        },
      );
      return { reference };
    },
  }) as Promise<FormState<VolunteerField>>;
}
