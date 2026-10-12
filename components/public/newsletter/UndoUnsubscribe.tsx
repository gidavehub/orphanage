"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import type { UnsubscribeOutcome } from "@/lib/server/intake/newsletter";

type Props = {
  token: string;
  action: (prev: UnsubscribeOutcome | null, fd: FormData) => Promise<UnsubscribeOutcome>;
};

/** The Undo button on /unsubscribe (public-pages §3.23): one click puts the person back on the list. */
export function UndoUnsubscribe({ token, action }: Props) {
  const [state, formAction] = useActionState<UnsubscribeOutcome | null, FormData>(action, null);

  if (state?.state === "resubscribed") {
    return (
      <p role="status" className="text-[16px] font-bold text-forest">
        Welcome back! You&rsquo;ll keep receiving our updates.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid justify-items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <SubmitButton variant="outline" icon="none" pendingLabel="Restoring…">
        <span className="inline-flex items-center gap-2">
          <RotateCcw aria-hidden className="size-4" strokeWidth={2.5} /> Undo, Keep Me Subscribed
        </span>
      </SubmitButton>
      {state && state.state !== "unsubscribed" ? (
        <p role="alert" className="text-[14px] text-coral-800">
          We couldn&rsquo;t do that just now. Please try again in a moment.
        </p>
      ) : null}
    </form>
  );
}
