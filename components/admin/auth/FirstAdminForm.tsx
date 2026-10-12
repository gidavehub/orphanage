"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { COPY } from "@/lib/admin/copy";
import { IDLE, type FormState } from "@/lib/forms/types";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Field = "displayName" | "email" | "password";
type Action = (prev: FormState<Field>, fd: FormData) => Promise<FormState<Field>>;

/**
 * "Create the first super admin" (PLAN §4.4): shown only in practice mode while no staff account
 * exists and LOCAL_ADMIN_* is not set. The Server Action re-checks both conditions, creates the
 * account, signs it in and opens Today.
 */
export function FirstAdminForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE as FormState<Field>);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const formMessage = state.status === "error" && Object.keys(fieldErrors).length === 0 ? state.message : null;

  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-5">
      <Field name="displayName" label="Your name" state={state}>
        <Input autoComplete="name" required />
      </Field>
      <Field name="email" label={COPY["auth.email"]} state={state}>
        <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field
        name="password"
        label="Choose a password"
        hint="At least 12 characters. A short sentence you'll remember works well."
        error={fieldErrors.password}
      >
        <PasswordInput autoComplete="new-password" required />
      </Field>
      <div>
        <SubmitButton variant="forest" block icon="arrow-right" pendingLabel="Creating your account…">
          {COPY["auth.firstAdmin"]}
        </SubmitButton>
        <FormAlert message={formMessage} />
      </div>
    </form>
  );
}
