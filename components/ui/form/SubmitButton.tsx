"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonAsButtonProps } from "../Button";

export type SubmitButtonProps = Omit<ButtonAsButtonProps, "type" | "loading"> & {
  /** Label while the form is sending ("Sending securely…"). */
  pendingLabel?: string;
  /** Force the pending look (e.g. while a client upload finishes). */
  pending?: boolean;
};

/** A submit Button that shows its spinner and pending label and disables itself while the form sends. */
export function SubmitButton({ pendingLabel, pending: forced, children, disabled, variant = "forest", ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const busy = pending || !!forced;
  return (
    <Button type="submit" variant={variant} loading={busy} disabled={disabled} {...rest}>
      {busy && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
