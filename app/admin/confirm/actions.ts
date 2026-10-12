"use server";

// Step-up and idle unlock (PLAN D86–D87; data-model §9.1). Both record a fresh real sign-in for the
// current session (refreshes `authTime`): practice mode checks the password here; Firebase mode
// receives a fresh ID token for the same person from the client. On success the person goes back to
// where they were (`next`, admin paths only).

import { redirect } from "next/navigation";
import { formDataOf, formError, type FormState } from "@/lib/forms/types";
import { safeNextPath } from "@/lib/model/session";
import { refreshSessionAuth } from "@/lib/server/auth/session";
import { log } from "@/lib/server/log";

export type ConfirmField = "password";

export async function confirmIdentity(_prev: FormState<ConfirmField>, fd: FormData): Promise<FormState<ConfirmField>> {
  fd = formDataOf(fd);
  const next = safeNextPath(typeof fd.get("next") === "string" ? (fd.get("next") as string) : "/admin");
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const idToken = typeof fd.get("idToken") === "string" ? (fd.get("idToken") as string) : "";
  if (!password && !idToken) {
    return formError("validation", "Please enter your password.", { fieldErrors: { password: "Please enter your password." } }) as FormState<ConfirmField>;
  }
  let result: Awaited<ReturnType<typeof refreshSessionAuth>>;
  try {
    result = await refreshSessionAuth(idToken ? { idToken: idToken.slice(0, 8192) } : { password: password.slice(0, 256) });
  } catch (err) {
    log.error("auth.confirm_failed", { err });
    return formError("server", "Something went wrong on our side. Please try again.") as FormState<ConfirmField>;
  }
  if (result === "no_session") redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  if (result === "invalid") {
    return formError("validation", "That password didn't match. Please try again.", { fieldErrors: { password: "That password didn't match. Please try again." } }) as FormState<ConfirmField>;
  }
  redirect(next);
}
