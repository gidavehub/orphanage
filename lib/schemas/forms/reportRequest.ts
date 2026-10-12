// The report request (/request-a-report and the inline form on /resources/[slug]; public-pages
// §3.10–3.11, data-model §4.5, PLAN D59). Isomorphic. Field names map onto the ReportRequest record:
//   report → resourceId (a listed slug) or "other" (resourceId null + requestedTitle from `describe`);
//   fullName, organisation, email, country → requester; reason; consent.

import { z } from "zod";
import { consentSchema, countrySchema, emailSchema, optionalStr, slugSchema, str } from "@/lib/schemas/common";

export const REPORT_OTHER = "other";
export const REPORT_REASON_MIN = 20;
export const REPORT_REASON_MAX = 1500;

const MSG = {
  report: "Please choose the report you would like, or “Other / not listed”.",
  describe: "Please describe the report you are looking for.",
} as const;

export const reportRequestSchema = z
  .object({
    report: z.union([z.literal(REPORT_OTHER), slugSchema], { error: MSG.report }),
    describe: optionalStr(200),
    fullName: str(100, { min: 2 }),
    organisation: optionalStr(120),
    email: emailSchema,
    country: countrySchema,
    reason: str(REPORT_REASON_MAX, { min: REPORT_REASON_MIN, multiline: true }),
    consent: consentSchema,
  })
  .superRefine((d, ctx) => {
    if (d.report === REPORT_OTHER && !d.describe) ctx.addIssue({ code: "custom", path: ["describe"], message: MSG.describe });
  });

export type ReportRequestInput = z.input<typeof reportRequestSchema>;
export type ReportRequestData = z.output<typeof reportRequestSchema>;
export type ReportRequestField = keyof ReportRequestInput;

export const REPORT_REQUEST_FIELD_ORDER: ReportRequestField[] = ["report", "describe", "fullName", "organisation", "email", "country", "reason", "consent"];
export const REPORT_REQUEST_ECHO_KEYS: ReportRequestField[] = REPORT_REQUEST_FIELD_ORDER.filter((k) => k !== "consent");
