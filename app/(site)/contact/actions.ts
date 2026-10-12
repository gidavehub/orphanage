"use server";

import type { FormState } from "@/lib/forms/types";
import { submitContactForm, type ContactSuccess } from "@/lib/server/intake/contact";

/** Contact (public-pages §3.8). Everything happens in lib/server/intake/contact.ts. */
export async function submitContact(_prev: FormState<string, ContactSuccess>, fd: FormData): Promise<FormState<string, ContactSuccess>> {
  return submitContactForm(fd);
}
