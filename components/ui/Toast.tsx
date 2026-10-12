"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Heart, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "default" | "success" | "danger";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** One action, usually "Undo". Toasts with an action stay 10s instead of 5s. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it leaves on its own (default 5000, or 10000 with an action). */
  duration?: number;
  /** Re-using an id replaces that toast (e.g. "Saving…" → "Saved"). */
  id?: string;
};

export type ToastApi = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  /** False outside a ToastProvider (calls are then no-ops). */
  available: boolean;
};

type Item = ToastOptions & { id: string; key: string; leaving?: boolean };

const ToastContext = createContext<ToastApi | null>(null);
const MAX = 3;
const EXIT_MS = 200;

let counter = 0;
const nextId = () => `t${++counter}`;

const NOOP: ToastApi = {
  toast: () => "",
  dismiss: () => {},
  available: false,
};

/** The toast API. Outside a ToastProvider it is a harmless no-op, so shared components never crash. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}

function ToastView({ item, onDismiss }: { item: Item; onDismiss: (id: string) => void }) {
  const duration = item.duration ?? (item.action ? 10_000 : 5_000);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused || item.leaving) return;
    startedAt.current = Date.now();
    const t = setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.leaving, item.id, onDismiss]);

  const tone = item.tone ?? "default";
  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[20px] bg-night px-5 py-4 text-white shadow-float focus-marigold",
        item.leaving
          ? "animate-[toast-out_0.2s_ease-out_both]"
          : "animate-[hero-rise_0.5s_var(--ease-out-expo)_both] motion-reduce:animate-none",
      )}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {tone === "success" ? (
          <span className="grid size-6 place-items-center rounded-full bg-mint text-forest">
            <Check className="size-3.5" strokeWidth={3.5} />
          </span>
        ) : tone === "danger" ? (
          <AlertCircle className="size-5 text-coral" strokeWidth={2.25} />
        ) : (
          <Heart className="size-5 text-marigold" fill="currentColor" strokeWidth={0} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-snug">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-[14px] leading-snug text-white/80">{item.description}</p> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="-my-1 shrink-0 rounded-full px-3 py-1.5 text-[14px] font-extrabold text-marigold underline-offset-4 transition-colors hover:bg-white/10 hover:underline"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="-mr-2 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden className="size-4" strokeWidth={2.5} />
      </button>
      {item.action && !item.leaving ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-marigold"
          style={{ animation: `drain ${duration}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
        />
      ) : null}
    </li>
  );
}

/**
 * In-house toasts (D120; no sonner): bottom-centre on phones, bottom-left on desktop clear of
 * ScrollTop, above QuickExit (globals.css) and above the admin dock (set `--toast-bottom` on an
 * ancestor). `aria-live="polite"`, at most three, paused while hovered or focused.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setItems((xs) => xs.filter((x) => x.id !== id));
      }, EXIT_MS),
    );
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = options.id ?? nextId();
    setItems((xs) => {
      const rest = xs.filter((x) => x.id !== id && !x.leaving);
      // A fresh key per call: replacing a toast by id restarts its timer.
      return [...rest, { ...options, id, key: nextId() }].slice(-MAX);
    });
    return id;
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss, available: true }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        data-toast-region
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-[var(--toast-bottom,1rem)] z-[95] md:left-6 md:right-auto md:bottom-[var(--toast-bottom-md,1.5rem)] md:w-[400px]"
      >
        <ol aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-2.5">
          {items.map((item) => (
            <ToastView key={item.key} item={item} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
