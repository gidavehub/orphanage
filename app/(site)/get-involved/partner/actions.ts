"use server";

import type { FormState } from "@/lib/forms/types";
import type { PartnershipField } from "@/lib/schemas/forms/partnership";
import { submitPartnership } from "@/lib/server/intake/partnership";

/** /get-involved/partner: the enquiry's Server Action. All checks live in the intake pipeline. */
export async function enquireAboutPartnership(_prev: FormState<PartnershipField>, formData: FormData): Promise<FormState<PartnershipField>> {
  return submitPartnership(formData);
}
