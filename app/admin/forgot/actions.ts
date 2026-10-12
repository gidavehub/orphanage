"use server";

// "Forgot your password?" (PLAN D88): always the same answer, so it never reveals who has an account.
// Practice mode issues a one-hour reset link through `staff_password_reset`; Firebase mode asks
// Firebase for its reset link and sends it the same way.

import { createHash } from "node:crypto";
import { z } from "zod";
import { formDataOf, formError, type FormState } from "@/lib/forms/types";
import { emailSchema } from "@/lib/schemas/common";
import { firebasePasswordResetLink } from "@/lib/server/auth/firebase";
import { createLocalResetToken, findLocalAccountByEmail } from "@/lib/server/auth/local";
import { enqueueEmail, drainAfterResponse } from "@/lib/server/email/outbox";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { absolute } from "@/lib/server/url";

const Input = z.object({ email: emailSchema });

export async function forgotAction(_prev: FormState<"email">, fd: FormData): Promise<FormState<"email">> {
  fd = formDataOf(fd);
  const parsed = Input.safeParse({ email: String(fd.get("email") ?? "") });
  if (!parsed.success) return formError("validation", "Please enter your email address.", { fieldErrors: { email: "Please enter your email address." } }) as FormState<"email">;
  const email = parsed.data.email;
  try {
    let link: string | null = null;
    if (resolveBackend() === "local") {
      const account = await findLocalAccountByEmail(email);
      if (account) link = absolute(`/admin/reset/${await createLocalResetToken(account.uid)}`);
    } else {
      link = await firebasePasswordResetLink(email, absolute("/admin/login")).catch(() => null);
    }
    if (link) {
      await enqueueEmail({ template: "staff_password_reset", to: [email], vars: { link }, dedupeKey: `reset~${createHash("sha256").update(link).digest("hex").slice(0, 24)}` });
      drainAfterResponse();
    }
  } catch (err) {
    log.warn("auth.forgot_failed", { err });
  }
  return { status: "success", message: "If that address has a Haven team account, we’ve sent a link to reset the password. It works for 1 hour." };
}
