"use client";

import { createContext, useContext, useMemo, useReducer, useRef, useState } from "react";
import { donateReducer, initialState, type DonateAction, type DonateState, type GivingConfig, type WidgetCause } from "./model";

// Shared state for /donate and /donate/[cause] (public-pages §4.3–4.4). It lives in the (give)
// layout, which persists across cause navigations, so switching cause swaps only the left column and
// the widget keeps its amount, currency, step and typed details. The left-column panels (where it
// goes, impact examples, other ways) read and nudge the same state.

export type DonateContextValue = {
  state: DonateState;
  dispatch: React.Dispatch<DonateAction>;
  config: GivingConfig;
  causes: WidgetCause[];
  bySlug: Map<string, WidgetCause>;
  /** The cause the widget is giving to (after the closed → general fallback). */
  activeSlug: string;
  setActiveSlug: (slug: string) => void;
  /** The widget's outer element (the mobile sticky bar scrolls back to it). */
  widgetRef: React.RefObject<HTMLDivElement | null>;
};

const DonateContext = createContext<DonateContextValue | null>(null);

export function DonateStateProvider({ config, causes, children }: { config: GivingConfig; causes: WidgetCause[]; children: React.ReactNode }) {
  const [state, dispatch] = useReducer(donateReducer, config.defaultCurrency, (c) => initialState(c));
  const [activeSlug, setActiveSlug] = useState("general");
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const bySlug = useMemo(() => new Map(causes.map((c) => [c.slug, c])), [causes]);
  const value = useMemo<DonateContextValue>(
    () => ({ state, dispatch, config, causes, bySlug, activeSlug, setActiveSlug, widgetRef }),
    [state, config, causes, bySlug, activeSlug],
  );
  return <DonateContext.Provider value={value}>{children}</DonateContext.Provider>;
}

/** The shared donate state, or null outside /donate (the landing widget keeps its own). */
export function useDonateContext(): DonateContextValue | null {
  return useContext(DonateContext);
}
