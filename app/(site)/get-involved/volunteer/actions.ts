"use server";

import type { FormState } from "@/lib/forms/types";
import type { VolunteerField } from "@/lib/schemas/forms/volunteer";
import { submitVolunteer } from "@/lib/server/intake/volunteer";

/** /get-involved/volunteer: the application's Server Action. All checks live in the intake pipeline. */
export async function applyToVolunteer(_prev: FormState<VolunteerField>, formData: FormData): Promise<FormState<VolunteerField>> {
  return submitVolunteer(formData);
}
