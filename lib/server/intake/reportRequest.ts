import "server-only";

// The report request intake (public-pages §3.10–3.11, data-model §4.5, PLAN D59). One transaction:
//   reportRequests/{HVN-RR-YYYY-NNNN} (status `new`; resourceId + title snapshot for a listed report,
//   or resourceId null + requestedTitle for "Other / not listed") + the resource's requestCount + 1
//   (stored resources only; the seeded placeholder has no stored record) + a "created" event +
//   report_request_confirmation + a "New report request" notification for report managers + audit.
// A public resource needs no request; the form offers the download instead, and the server still
// accepts the request (the team then simply sends the link).

import type { FormState } from "@/lib/forms/types";
import type { ReportRequest } from "@/lib/model/domain/library";
import type { Millis } from "@/lib/model/enums";
import { adminHrefOfRef } from "@/lib/model/refs";
import { emailLowerOf } from "@/lib/schemas/common";
import { REPORT_OTHER, REPORT_REQUEST_ECHO_KEYS, reportRequestSchema, type ReportRequestData, type ReportRequestField } from "@/lib/schemas/forms/reportRequest";
import { auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { F } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { caseBase, firstNameOf } from "@/lib/server/intake/caseBase";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { getResource } from "@/lib/server/public/resources";
import { createWithReference } from "@/lib/server/references";

type Target = { resourceId: string | null; title: string; requestedTitle: string | null; stored: boolean };

async function targetOf(d: ReportRequestData): Promise<Target | null> {
  if (d.report === REPORT_OTHER) return { resourceId: null, title: d.describe ?? "A report not listed", requestedTitle: d.describe, stored: false };
  const r = await getResource(d.report);
  if (!r) return null;
  const stored = !!(await getStore().get(docPath("resources", r.id)));
  return { resourceId: r.id, title: r.title, requestedTitle: null, stored };
}

function buildRequest(reference: string, now: Millis, d: ReportRequestData, t: Target): ReportRequest {
  const emailLower = emailLowerOf(d.email);
  return {
    ...caseBase(reference, "new", now, "report_request", { email: emailLower, names: [d.fullName, d.organisation] }),
    resourceId: t.resourceId,
    resourceTitle: t.title,
    requestedTitle: t.requestedTitle,
    requester: { fullName: d.fullName, organisation: d.organisation, email: d.email, emailLower, country: d.country },
    reason: d.reason,
    consent: consentStamp(now),
    decision: null,
    delivery: null,
  };
}

export async function submitReportRequest(fd: FormData): Promise<FormState<ReportRequestField>> {
  return runIntake({
    form: "report_request",
    input: fd,
    schema: reportRequestSchema,
    echoKeys: REPORT_REQUEST_ECHO_KEYS,
    create: async (d) => {
      const [target, recipients] = await Promise.all([targetOf(d), recipientsFor("report_request_new")]);
      // A slug that is no longer published is treated as "not listed", keeping the person's wording.
      const t: Target = target ?? { resourceId: null, title: d.describe ?? d.report, requestedTitle: d.describe ?? d.report, stored: false };
      const reference = await createWithReference<ReportRequest>(
        "reportRequests",
        (ref, now) => buildRequest(ref, now, d, t),
        async (tx, ref, now) => {
          const path = docPath("reportRequests", ref);
          if (t.resourceId && t.stored) tx.update(docPath("resources", t.resourceId), { requestCount: F.increment(1), updatedAt: now });
          addEventTx(tx, path, {
            type: "created",
            actor: { kind: "public" },
            summary: t.resourceId ? `Report requested through the website: ${t.title}` : "A report that is not listed was requested through the website",
            at: now,
          });
          await enqueueEmailTx(tx, {
            template: "report_request_confirmation",
            to: [d.email],
            vars: { reference: ref, firstName: firstNameOf(d.fullName) },
            related: { path, reference: ref },
          });
          addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Report request confirmation email queued", at: now });
          if (recipients.length) {
            notifyTx(tx, { recipientUids: recipients, kind: "new_case", title: `New report request ${ref}`, href: adminHrefOfRef(ref, "reportRequest") });
          }
          auditTx(tx, {
            actor: { kind: "public" },
            action: "report_request.submit",
            area: "resources",
            summary: `A report was requested on the website (${ref})`,
            feed: true,
            targetPath: path,
            targetRef: ref,
          });
        },
      );
      return { reference };
    },
  }) as Promise<FormState<ReportRequestField>>;
}
