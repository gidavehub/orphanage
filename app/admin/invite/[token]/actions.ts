"use server";

// Accept a team invitation (admin-ux §6.14; PLAN D88): choose a password, the account and staff
// profile are created. Practice mode signs the person in and opens Today; with Firebase, a session
// needs a Firebase ID token, so they sign in once (and set up a sign-in code if their role needs one).

import { redirect } from "next/navigation";
import { formDataOf, formError, type FormState } from "@/lib/forms/types";
import { acceptInvitation } from "@/lib/server/auth/invitations";
import { resolveBackend } from "@/lib/server/env";
import { deviceLabelFrom, startSession } from "@/lib/server/auth/session";
import { headers } from "next/headers";

export async function acceptInviteAction(_prev: FormState<"password">, fd: FormData): Promise<FormState<"password">> {
  fd = formDataOf(fd);
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const r = await acceptInvitation(token, password);
  if (!r.ok) return formError("validation", r.message, r.field ? { fieldErrors: { password: r.message } } : undefined) as FormState<"password">;
  if (resolveBackend() === "firestore") redirect("/admin/login?welcome=1");
  const ua = (await headers()).get("user-agent");
  await startSession(r.uid, { authTime: Date.now(), remember: false, device: deviceLabelFrom(ua) ?? undefined });
  redirect("/admin");
}
