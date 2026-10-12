"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/form/Field";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { IDLE, type FormState } from "@/lib/forms/types";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Action = (prev: FormState<"password">, fd: FormData) => Promise<FormState<"password">>;

/** Choose a password (accepting an invitation, or after "Forgot your password?"). */
export function PasswordSetForm({ action, token, submitLabel, pendingLabel }: { action: Action; token: string; submitLabel: string; pendingLabel: string }) {
  const [state, formAction] = useActionState<FormState<"password">, FormData>(action, IDLE as FormState<"password">);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const formMessage = state.status === "error" && Object.keys(fieldErrors).length === 0 ? state.message : null;
  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-5">
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="Choose a password" hint="At least 12 characters. A short sentence you’ll remember works well." error={fieldErrors.password}>
        <PasswordInput autoComplete="new-password" required />
      </Field>
      <div>
        <SubmitButton variant="forest" block icon="arrow-right" pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
        <FormAlert message={formMessage} />
      </div>
    </form>
  );
}
