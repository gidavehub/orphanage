"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/form/Field";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { IDLE, type FormState } from "@/lib/forms/types";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** "Email me a link" for donors who give regularly by card (integrations §3.7). */
export function ManageLinkForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, IDLE);
  if (state.status === "success") {
    return <FormSuccess title="Check your email" message={state.message ?? "If you have a regular gift with us, we’ve emailed you a link to manage it."} />;
  }
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} noValidate className="grid gap-5">
      <Honeypot />
      <Turnstile action="manage_link" />
      <Field name="email" label="The email address you give with" state={state} error={fieldErrors.email}>
        <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <div>
        <SubmitButton variant="forest" icon="arrow-right" pendingLabel="Sending…">
          Email me a link
        </SubmitButton>
        {state.status === "error" && !fieldErrors.email ? (
          <p role="alert" className="mt-3 text-[15px] font-semibold text-danger">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
