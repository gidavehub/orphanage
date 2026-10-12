"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { COPY } from "@/lib/admin/copy";
import { IDLE, type FormState } from "@/lib/forms/types";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Field = "email" | "password";
type Action = (prev: FormState<Field>, fd: FormData) => Promise<FormState<Field>>;

/**
 * Email and password sign-in for practice mode (data-model §9.3): posts to the `signIn` Server Action,
 * which redirects to `next` on success. Field errors sit under each field; the "doesn't match" and
 * lockout messages sit under the button (admin-ux §6.1). The password is never echoed back.
 */
export function LocalSignInForm({ action, next }: { action: Action; next: string }) {
  const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE as FormState<Field>);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const formMessage = state.status === "error" && Object.keys(fieldErrors).length === 0 ? state.message : null;

  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-5">
      <input type="hidden" name="next" value={next} />
      <Field name="email" label={COPY["auth.email"]} state={state}>
        <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field name="password" label={COPY["auth.password"]} error={fieldErrors.password}>
        <PasswordInput required />
      </Field>
      <Checkbox name="remember" label={`${COPY["auth.keepSignedIn"]}.`} hint="Leave this unticked on a shared computer: you'll be signed out when the browser closes." />
      <div>
        <SubmitButton variant="forest" block icon="arrow-right" pendingLabel={COPY["auth.signingIn"]}>
          {COPY["auth.signIn"]}
        </SubmitButton>
        <FormAlert message={formMessage} />
      </div>
      <Link href="/admin/forgot" className="inline-flex min-h-11 w-fit items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        {COPY["auth.forgot"]}
      </Link>
    </form>
  );
}
