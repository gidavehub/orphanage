"use server";

// Choose a new password from a reset link (PLAN D88; practice mode: one hour, one use). Every session
// is signed out, and the person signs in again with the new password.

import { redirect } from "next/navigation";
import { formDataOf, formError, type FormState } from "@/lib/forms/types";
import { consumeLocalResetToken } from "@/lib/server/auth/local";

export async function resetAction(_prev: FormState<"password">, fd: FormData): Promise<FormState<"password">> {
  fd = formDataOf(fd);
  const r = await consumeLocalResetToken(String(fd.get("token") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return formError("validation", r.message, r.reason === "policy" ? { fieldErrors: { password: r.message } } : undefined) as FormState<"password">;
  redirect("/admin/login?reset=1");
}
