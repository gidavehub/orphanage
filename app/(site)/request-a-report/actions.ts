"use server";

import type { FormState } from "@/lib/forms/types";
import type { ReportRequestField } from "@/lib/schemas/forms/reportRequest";
import { submitReportRequest } from "@/lib/server/intake/reportRequest";

/** /request-a-report and the inline form on /resources/[slug]. All checks live in the intake pipeline. */
export async function requestReport(_prev: FormState<ReportRequestField>, formData: FormData): Promise<FormState<ReportRequestField>> {
  return submitReportRequest(formData);
}
