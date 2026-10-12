"use server";

import type { FormState } from "@/lib/forms/types";
import { submitConcernForm, type ConcernSuccess } from "@/lib/server/intake/concern";

/** Report a concern (public-pages §3.7). Kept and flagged, never discarded (D94). */
export async function submitConcern(_prev: FormState<string, ConcernSuccess>, fd: FormData): Promise<FormState<string, ConcernSuccess>> {
  return submitConcernForm(fd);
}
