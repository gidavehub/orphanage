"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/forms/types";

/** "Send me a test email" (admin-ux §6.16): proves emails reach you, or shows where they're held. */
export function TestEmailButton({ send }: { send: () => Promise<ActionResult<{ id: string; mode: string }>> }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [held, setHeld] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon="none"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await send();
            if (!r.ok) {
              toast({ title: r.error.kind === "validation" ? "Please check." : r.error.message, tone: "danger" });
              return;
            }
            const mailbox = r.data.mode === "mailbox";
            setHeld(mailbox);
            toast({ title: mailbox ? "Test email is waiting in the email log" : "Test email sent. Check your inbox.", tone: "success" });
          })
        }
      >
        <Send aria-hidden className="size-4" /> Send me a test email
      </Button>
      {held ? (
        <Link href="/admin/settings/email-log?status=held" className="text-[14.5px] font-bold text-forest underline-offset-4 hover:underline">
          Open the email log
        </Link>
      ) : null}
    </div>
  );
}
