"use server";

import type { FormState } from "@/lib/forms/types";
import { submitSupportForm, type SupportSuccess } from "@/lib/server/intake/support";

/** Request Support (public-pages §3.6). Everything happens in lib/server/intake/support.ts. */
export async function submitSupportRequest(_prev: FormState<string, SupportSuccess>, fd: FormData): Promise<FormState<string, SupportSuccess>> {
  return submitSupportForm(fd);
}
