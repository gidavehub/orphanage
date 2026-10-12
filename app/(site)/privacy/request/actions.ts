"use server";

// The privacy request form's Server Action (PLAN D104). Validation, spam controls, the record, the
// verification email and the audit entry all live in lib/server/intake/dataRequest.ts.

import type { FormState } from "@/lib/forms/types";
import { submitDataRequest } from "@/lib/server/intake/dataRequest";

export async function sendDataRequest(prev: FormState, formData: FormData): Promise<FormState> {
  void prev;
  return submitDataRequest(formData);
}
