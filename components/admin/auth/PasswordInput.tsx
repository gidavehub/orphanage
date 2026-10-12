"use client";

import { useState } from "react";
import { Input, type InputProps } from "@/components/ui/form/Input";

/**
 * A password field with a "Show" toggle (admin-ux §6.1). Wrap it in <Field>, which supplies the id,
 * name and aria wiring. The toggle is a real button with a pressed state and never submits the form.
 */
export function PasswordInput({ autoComplete = "current-password", ...rest }: Omit<InputProps, "type" | "trailing">) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...rest}
      type={shown ? "text" : "password"}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={() => setShown((s) => !s)}
          className="-mr-2 inline-flex h-9 items-center rounded-full px-3 text-[14px] font-bold text-forest transition-colors hover:bg-mint"
        >
          {shown ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
