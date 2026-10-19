"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/form/Field";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { IDLE, type FormState } from "@/lib/forms/types";
import { reauthenticate } from "@/lib/client/firebase";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Action = (prev: FormState<"password">, fd: FormData) => Promise<FormState<"password">>;

/**
 * "Confirm it's you" (step-up, D87) and the idle unlock (D86). Practice mode posts the password to
 * the Server Action; Firebase mode signs in again in the browser and posts the fresh ID token instead
 * (the session keeps the second step it already had). The action redirects back to `next`.
 */
export function ConfirmForm({
  action,
  mode,
  email,
  next,
  submitLabel,
}: {
  action: Action;
  mode: "local" | "firebase";
  /** The signed-in person's email (Firebase re-authentication only). */
  email: string;
  next: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState<"password">, FormData>(action, IDLE as FormState<"password">);
  const [pending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const serverMessage = state.status === "error" && !fieldErrors.password ? state.message : null;

  function sendToken(idToken: string) {
    const fd = new FormData();
    fd.set("idToken", idToken);
    fd.set("next", next);
    startTransition(() => formAction(fd));
  }

  async function onFirebaseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (!password) {
      setClientError("Please enter your password.");
      return;
    }
    const res = await reauthenticate(email, password);
    if (res.kind === "ok") sendToken(res.idToken);
    else setClientError(res.message);
  }

  if (mode === "firebase") {
    return (
      <form onSubmit={onFirebaseSubmit} noValidate className="grid grid-cols-1 gap-5">
        <Field name="password" label="Password" error={fieldErrors.password}>
          <PasswordInput required autoFocus />
        </Field>
        <div>
          <Button type="submit" variant="forest" block icon="arrow-right" loading={pending}>
            {submitLabel}
          </Button>
          <FormAlert message={clientError ?? serverMessage} />
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-5">
      <input type="hidden" name="next" value={next} />
      <Field name="password" label="Password" error={fieldErrors.password}>
        <PasswordInput required autoFocus />
      </Field>
      <div>
        <SubmitButton variant="forest" block icon="arrow-right" pendingLabel="Checking…">
          {submitLabel}
        </SubmitButton>
        <FormAlert message={serverMessage} />
      </div>
    </form>
  );
}
