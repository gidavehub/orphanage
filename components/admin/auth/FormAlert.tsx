import { AlertCircle } from "lucide-react";

/**
 * The sign-in error box (admin-ux §6.1): soft coral with urgent text, directly under the button, and
 * announced to screen readers. Place it in the same wrapper as the button: the live region stays
 * mounted (and takes no room) while there is no message.
 */
export function FormAlert({ message, className }: { message?: string | null; className?: string }) {
  return (
    <div role="alert" aria-live="assertive" className={className}>
      {message ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-coral-100 px-4 py-3 text-[15px] font-semibold leading-snug text-coral-800">
          <AlertCircle aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.5} />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
