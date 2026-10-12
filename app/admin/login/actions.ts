"use server";

// Staff session Server Actions (PLAN D86, D90; next16 §6 "session start and logout"). Local practice
// mode signs in here; Firebase mode signs in on the client and exchanges the ID token at
// POST /api/auth/session. Sign-out is a Server Action followed by a full page load on the client
// (window.location.replace), so no hidden route keeps the previous person's screens (next16 §5).

import { redirect } from "next/navigation";
import { z } from "zod";
import { formDataOf, formError, type FormState } from "@/lib/forms/types";
import { isRole, type Role } from "@/lib/model/permissions";
import { safeNextPath } from "@/lib/model/session";
import { COPY } from "@/lib/admin/copy";
import { emailSchema } from "@/lib/schemas/common";
import { createFirstSuperAdmin, localSignIn, needsFirstAdmin } from "@/lib/server/auth/local";
import { endSession, startSession } from "@/lib/server/auth/session";
import { devSignInAs } from "@/lib/server/dev/session";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

export type SignInField = "email" | "password";
export type FirstAdminField = "displayName" | "email" | "password";

const SignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Please enter your password." }).max(256),
});

const FirstAdminSchema = z.object({
  displayName: z.string().trim().min(2, { error: "Please enter your name." }).max(80),
  email: emailSchema,
  password: z.string().min(1, { error: "Please choose a password." }).max(256),
});

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function firstErrors<K extends string>(err: z.ZodError): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "") as K;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Local practice sign-in with email and password (data-model §9.3). Redirects to `next` on success. */
export async function signIn(_prev: FormState<SignInField>, fd: FormData): Promise<FormState<SignInField>> {
  fd = formDataOf(fd);
  if (resolveBackend() !== "local") return formError("unavailable", COPY["auth.notConfigured"]) as FormState<SignInField>;
  const parsed = SignInSchema.safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  const values = { email: str(fd, "email").slice(0, 254) };
  if (!parsed.success) {
    return formError("validation", "Please check the highlighted fields and try again.", { fieldErrors: firstErrors(parsed.error), values }) as FormState<SignInField>;
  }
  const remember = fd.get("remember") === "on";
  const next = safeNextPath(str(fd, "next"));

  let result: Awaited<ReturnType<typeof localSignIn>>;
  try {
    result = await localSignIn(parsed.data.email, parsed.data.password);
  } catch (err) {
    log.error("auth.sign_in_action_failed", { err });
    return formError("server", "Something went wrong on our side. Please try again.", { values }) as FormState<SignInField>;
  }
  if (!result.ok) {
    switch (result.reason) {
      case "locked":
        return formError("rate_limited", "For safety, sign-in is paused for 15 minutes. Please try again later.", { values }) as FormState<SignInField>;
      case "rate_limited":
        return formError("rate_limited", COPY["auth.locked"], { values }) as FormState<SignInField>;
      case "inactive":
        return formError("validation", "This account is paused. Please ask a super admin.", { values }) as FormState<SignInField>;
      case "unavailable":
        return formError("unavailable", COPY["auth.notConfigured"]) as FormState<SignInField>;
      default:
        return formError("validation", COPY["auth.invalid"], { values }) as FormState<SignInField>;
    }
  }
  try {
    await startSession(result.uid, { authTime: result.authTime, remember });
  } catch (err) {
    log.error("auth.start_session_failed", { err });
    return formError("server", "Something went wrong on our side. Please try again.", { values }) as FormState<SignInField>;
  }
  redirect(next);
}

/** "Create the first super admin" (local only, and only while no account exists; PLAN §4.4). */
export async function createFirstAdmin(_prev: FormState<FirstAdminField>, fd: FormData): Promise<FormState<FirstAdminField>> {
  fd = formDataOf(fd);
  const values = { displayName: str(fd, "displayName").slice(0, 80), email: str(fd, "email").slice(0, 254) };
  if (!(await needsFirstAdmin())) {
    return formError("closed", "A team member already exists. Please sign in instead.", { values }) as FormState<FirstAdminField>;
  }
  const parsed = FirstAdminSchema.safeParse({ displayName: str(fd, "displayName"), email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) {
    return formError("validation", "Please check the highlighted fields and try again.", { fieldErrors: firstErrors(parsed.error), values }) as FormState<FirstAdminField>;
  }
  const created = await createFirstSuperAdmin(parsed.data);
  if (!created.ok) {
    return formError("validation", created.message, { fieldErrors: { password: created.message }, values }) as FormState<FirstAdminField>;
  }
  try {
    await startSession(created.uid, { authTime: Date.now(), remember: false });
  } catch (err) {
    log.error("auth.first_admin_session_failed", { err });
    return formError("server", "Your account was created. Please sign in.", { values }) as FormState<FirstAdminField>;
  }
  redirect("/admin");
}

/** Practice-mode one-tap sign-in as a seeded role (PLAN D90; devOnly inside devSignInAs). */
export async function signInAsRole(role: Role): Promise<void> {
  if (!isRole(role)) redirect("/admin/login");
  await devSignInAs(role);
  redirect("/admin");
}

/**
 * Ends this session (or every session of this person). The caller then does
 * window.location.replace('/admin/login') so the whole app reloads.
 */
export async function signOut(opts?: { everywhere?: boolean }): Promise<void> {
  await endSession({ everywhere: opts?.everywhere === true });
}
