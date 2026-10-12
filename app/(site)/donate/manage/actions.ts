"use server";

import type { FormState } from "@/lib/forms/types";
import { submitManageLinkForm } from "@/lib/server/intake/manage";

// /donate/manage: "Email me a link" (integrations §3.7). Always the same answer.

export async function requestManageLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return submitManageLinkForm(fd);
}
