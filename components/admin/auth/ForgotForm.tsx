"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { Notice } from "@/components/ui/Notice";
import { IDLE, type FormState } from "@/lib/forms/types";
import { FormAlert } from "./FormAlert";

type Action = (prev: FormState<"email">, fd: FormData) => Promise<FormState<"email">>;

/** Email for a reset link; the answer is the same whether or not the address has an account. */
export function ForgotForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState<"email">, FormData>(action, IDLE as FormState<"email">);
  if (state.status === "success") {
    return (
      <Notice tone="success" compact title="Check your email">
        {state.message}
      </Notice>
    );
  }
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-5">
      <Field name="email" label="Email address" state={state} error={fieldErrors.email}>
        <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <div>
        <SubmitButton variant="forest" block icon="arrow-right" pendingLabel="Sending…">
          Send me a link
        </SubmitButton>
        <FormAlert message={state.status === "error" && !fieldErrors.email ? state.message : null} />
      </div>
    </form>
  );
}
