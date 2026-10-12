"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UseStepperOptions = {
  /** Number of steps. */
  count: number;
  /** Validate the current step before moving on; return false (or resolve false) to stay. */
  validate?: (step: number) => boolean | Promise<boolean>;
  /** Id of each step's heading, focused after a step change (design-system §3.3). */
  headingId?: (step: number) => string;
  initial?: number;
};

export type Stepper = {
  /** 0-based current step. */
  step: number;
  isFirst: boolean;
  isLast: boolean;
  /** Validates the current step, then moves forward. Resolves true when it moved. */
  next: () => Promise<boolean>;
  back: () => void;
  /** Jump back to a completed step (forward jumps validate every step in between). */
  goTo: (step: number) => Promise<boolean>;
  /** Highest step reached so far (for clickable completed steps). */
  reached: number;
};

/**
 * Multi-step form state (pairs with <Stepper>): steps validate independently, focus moves to the new
 * step heading, and the form submits only from the last step (public-pages §2.4).
 */
export function useStepper({ count, validate, headingId, initial = 0 }: UseStepperOptions): Stepper {
  const [step, setStep] = useState(initial);
  const [reached, setReached] = useState(initial);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const el = headingId ? document.getElementById(headingId(step)) : null;
    if (!el) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step, headingId]);

  const move = useCallback((to: number) => {
    moved.current = true;
    setStep(to);
    setReached((r) => Math.max(r, to));
  }, []);

  const next = useCallback(async () => {
    if (step >= count - 1) return false;
    if (validate && !(await validate(step))) return false;
    move(step + 1);
    return true;
  }, [step, count, validate, move]);

  const back = useCallback(() => {
    if (step > 0) move(step - 1);
  }, [step, move]);

  const goTo = useCallback(
    async (to: number) => {
      if (to < 0 || to >= count || to === step) return false;
      if (to < step) {
        move(to);
        return true;
      }
      for (let s = step; s < to; s++) if (validate && !(await validate(s))) return false;
      move(to);
      return true;
    },
    [step, count, validate, move],
  );

  return { step, isFirst: step === 0, isLast: step === count - 1, next, back, goTo, reached };
}
