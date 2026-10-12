"use client";

import { Check } from "lucide-react";
import { ProgressBar } from "../ProgressBar";
import { cn } from "@/lib/cn";

export type StepperStep = { id: string; label: string };

export type StepperProps = {
  steps: StepperStep[];
  /** 0-based current step. */
  current: number;
  /** Only completed steps are clickable. */
  onStepClick?: (index: number) => void;
  className?: string;
};

/**
 * Progress through a multi-step form (design-system §3.3). Desktop: numbered discs joined by a line
 * that fills marigold up to the current step; done = forest with a check, current = forest with an
 * Anton numeral and a pulse halo. Phones: "Step 2 of 4 · Your details" plus a progress bar.
 * A polite live region announces each step change.
 */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  const total = steps.length;
  const here = steps[current];
  const pct = total > 1 ? (current / (total - 1)) * 100 : 100;

  return (
    <nav aria-label="Form progress" className={className}>
      <p aria-live="polite" className="sr-only">
        Step {current + 1} of {total}: {here?.label}
      </p>

      {/* Phones */}
      <div className="md:hidden" aria-hidden>
        <p className="text-[15px] font-bold text-ink">
          Step {current + 1} of {total} · <span className="font-semibold text-body">{here?.label}</span>
        </p>
        <ProgressBar percent={((current + 1) / total) * 100} tone="forest" animate={false} label="Form progress" className="mt-3" />
      </div>

      {/* Desktop */}
      <ol className="relative hidden md:flex md:items-start">
        <span
          aria-hidden
          className="absolute top-5 h-[2px] rounded-full bg-line"
          style={{ left: `calc(100% / ${2 * total})`, right: `calc(100% / ${2 * total})` }}
        >
          <span className="block h-full rounded-full bg-marigold transition-[width] duration-500 ease-out-expo motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </span>
        {steps.map((s, i) => {
          const done = i < current;
          const on = i === current;
          const clickable = done && !!onStepClick;
          const disc = (
            <span
              className={cn(
                "relative grid size-10 place-items-center rounded-full",
                done && "bg-forest text-white",
                on && "bg-forest font-display text-[17px] text-white",
                !done && !on && "border-[1.5px] border-edge bg-white font-grotesk text-[15px] font-semibold text-body",
              )}
            >
              {on ? <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-forest" /> : null}
              <span className="relative">{done ? <Check aria-hidden className="size-[18px]" strokeWidth={3.5} /> : i + 1}</span>
            </span>
          );
          const label = <span className={cn("mt-2.5 block text-center text-[14px] font-bold leading-snug", on || done ? "text-ink" : "text-body")}>{s.label}</span>;
          return (
            <li key={s.id} aria-current={on ? "step" : undefined} className="relative flex min-w-0 flex-1 flex-col items-center px-2">
              {clickable ? (
                <button type="button" onClick={() => onStepClick?.(i)} className="group flex flex-col items-center rounded-2xl outline-offset-4">
                  {disc}
                  <span className="group-hover:underline">{label}</span>
                  <span className="sr-only">, completed. Go back to this step.</span>
                </button>
              ) : (
                <>
                  {disc}
                  {label}
                  <span className="sr-only">{done ? ", completed" : on ? ", current step" : ", not started"}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
