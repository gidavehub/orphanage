import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type StepNavProps = {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Last step: the submit label ("Send My Request") and its pending label. */
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Blocks Continue/Send (files still uploading). */
  busy?: boolean;
  busyLabel?: string;
  /** The page shows QuickExit, whose bar sits under this one on phones. */
  aboveQuickExit?: boolean;
  className?: string;
};

/**
 * Back / Continue for multi-step forms (public-pages §2.4). On phones it is a sticky bar at the foot
 * of the viewport (above the QuickExit bar when present); from md it sits under the step.
 */
export function StepNav({ isFirst, isLast, onBack, onNext, submitLabel, pendingLabel, pending, busy, busyLabel, aboveQuickExit, className }: StepNavProps) {
  return (
    <div
      className={cn(
        "sticky z-20 -mx-5 mt-10 flex items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8",
        aboveQuickExit ? "bottom-[calc(48px+env(safe-area-inset-bottom))]" : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        "md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:pt-2 md:backdrop-blur-none",
        // On phones ScrollTop would float over this bar: hide it while a step form is on the page.
        "max-md:[:root:has(&)_[data-scroll-top]]:hidden",
        className,
      )}
    >
      {!isFirst ? (
        <Button variant="outline" size="md" icon="none" onClick={onBack} disabled={pending} className="shrink-0 max-sm:w-[52px] max-sm:px-0">
          <span className="inline-flex items-center gap-2">
            <ArrowLeft aria-hidden className="size-4" strokeWidth={2.5} /> <span className="max-sm:sr-only">Back</span>
          </span>
        </Button>
      ) : null}
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {isLast ? (
          <span className="hidden items-center gap-1.5 font-grotesk text-[13px] text-body lg:inline-flex">
            <Lock aria-hidden className="size-3.5 text-forest" strokeWidth={2.5} /> Sent securely
          </span>
        ) : null}
        {isLast ? (
          // Distinct keys: React must not turn the clicked Continue button into this submit button
          // mid-click, or the browser would submit the form the moment the last step appears.
          <Button key="submit" type="submit" variant="forest" size="md" icon="send" loading={pending} disabled={busy} className="min-w-0 max-sm:px-6">
            {pending ? pendingLabel : busy && busyLabel ? busyLabel : submitLabel}
          </Button>
        ) : (
          <Button key="next" type="button" variant="forest" size="md" icon="arrow-right" onClick={onNext} disabled={pending || busy} className="min-w-0 max-sm:px-6">
            {busy && busyLabel ? busyLabel : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
