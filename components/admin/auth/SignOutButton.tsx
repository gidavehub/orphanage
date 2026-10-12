"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export type SignOutAction = (opts?: { everywhere?: boolean }) => Promise<void>;

/**
 * Sign out (PLAN D86): the Server Action ends the session, then a full page load replaces the whole
 * app with the sign-in page, so no hidden route keeps the previous person's screens or drafts
 * (offices share devices; next16 §5). Even if the action fails, the reload still happens.
 */
export function SignOutButton({
  action,
  everywhere,
  label = "Sign out",
  variant = "menu",
  className,
}: {
  action: SignOutAction;
  everywhere?: boolean;
  label?: string;
  variant?: "menu" | "link" | "button";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await action(everywhere ? { everywhere: true } : undefined);
    } finally {
      // Wipe sessionStorage drafts too: the next person on this device must not see them.
      try {
        window.sessionStorage.clear();
      } catch {
        // storage can be unavailable (private mode); the reload still clears memory
      }
      window.location.replace("/admin/login");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={busy}
      disabled={busy}
      className={cn(
        variant === "menu" &&
          "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-bold text-coral-800 transition-colors hover:bg-coral-100",
        variant === "link" && "inline-flex min-h-11 items-center gap-2 font-bold text-forest underline-offset-4 hover:underline",
        variant === "button" &&
          "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-[14px] font-bold text-ink transition-colors hover:border-ink/40 hover:bg-cream",
        className,
      )}
    >
      {busy ? <Spinner size={16} label="Signing out" /> : variant === "link" ? null : <LogOut aria-hidden className="size-[18px]" strokeWidth={2.25} />}
      {label}
    </button>
  );
}
