"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { COPY } from "@/lib/admin/copy";
import { exchangeForSession, signInWithPassword, type EmailCodeStep } from "@/lib/client/firebase";
import { CodeForm } from "./CodeForm";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

/**
 * Firebase-mode sign-in (data-model §9.1; PLAN D86, D88): firebase/auth checks the password in the
 * browser, the ID token is exchanged for Haven's session cookie at POST /api/auth/session, then the
 * page reloads into the admin. Roles that need a second step are emailed a 6-digit code and type it
 * here (CodeForm); no authenticator app. The pending sign-in is held in memory only, so a reload
 * starts again.
 */
export function FirebaseSignInForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [code, setCode] = useState<{ idToken: string; step: EmailCodeStep; remember: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const remember = fd.get("remember") === "on";
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = "Please enter your email.";
    if (!password) errs.password = "Please enter your password.";
    setFieldErrors(errs);
    if (errs.email || errs.password) return;

    setBusy(true);
    setError(null);
    const result = await signInWithPassword(email, password);
    if (result.kind === "error") {
      setBusy(false);
      setError(result.message);
      return;
    }
    const session = await exchangeForSession(result.idToken, { remember, next });
    if (!session.ok) {
      setBusy(false);
      if (session.emailCode) setCode({ idToken: result.idToken, step: session.emailCode, remember });
      else setError(session.message);
      return;
    }
    // A full load: the admin starts fresh with the new session.
    window.location.assign(session.next);
  }

  if (code) return <CodeForm {...code} next={next} onCancel={() => setCode(null)} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-5">
      <Field name="email" label={COPY["auth.email"]} error={fieldErrors.email}>
        <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field name="password" label={COPY["auth.password"]} error={fieldErrors.password}>
        <PasswordInput required />
      </Field>
      <Checkbox name="remember" label={`${COPY["auth.keepSignedIn"]}.`} hint="Leave this unticked on a shared computer: you'll be signed out when the browser closes." />
      <div>
        <Button type="submit" variant="forest" block icon="arrow-right" loading={busy}>
          {busy ? COPY["auth.signingIn"] : COPY["auth.signIn"]}
        </Button>
        <FormAlert message={error} />
      </div>
      <Link href="/admin/forgot" className="inline-flex min-h-11 w-fit items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        {COPY["auth.forgot"]}
      </Link>
    </form>
  );
}
