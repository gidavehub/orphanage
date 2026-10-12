"use client";

import { useEffect, useRef, useState } from "react";
import { TURNSTILE_FIELD } from "@/lib/forms/spam";

export type TurnstileProps = {
  /** NEXT_PUBLIC_TURNSTILE_SITE_KEY by default; pass null to switch it off. */
  siteKey?: string | null;
  /** The form's Turnstile action; the server requires it to match (integrations §9). */
  action?: string;
  className?: string;
};

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** How long a submit may wait for the (invisible) check to finish. */
const WAIT_MS = 5000;
let loading: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  const w = window as typeof window & { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    const timer = window.setTimeout(() => resolve(null), 8000);
    s.onload = () => {
      window.clearTimeout(timer);
      resolve(w.turnstile ?? null);
    };
    s.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile (integrations §9; PLAN D120). Explicit render, "interaction-only": most people
 * never see it. The token goes into the hidden `cf-turnstile-response` field the server checks. A
 * submit that comes before the check has finished waits for it (up to 5 seconds), so quick people
 * aren't refused. When Cloudflare can't be reached the field stays empty and the server decides
 * (support and concern still go through). Without a site key nothing renders.
 */
export function Turnstile({ siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null, action, className }: TurnstileProps): React.ReactNode {
  const box = useRef<HTMLDivElement>(null);
  const tokenRef = useRef("");
  const waiting = useRef<Array<() => void>>([]);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget: string | null = null;
    let live = true;
    let unavailable = false;
    const accept = (t: string) => {
      tokenRef.current = t;
      setToken(t);
      if (t) for (const go of waiting.current.splice(0)) go();
    };
    void loadScript().then((api) => {
      if (!live) return;
      if (!api || !box.current) {
        unavailable = true;
        for (const go of waiting.current.splice(0)) go();
        return;
      }
      widget = api.render(box.current, {
        sitekey: siteKey,
        ...(action ? { action } : {}),
        appearance: "interaction-only",
        theme: "light",
        callback: (t: string) => accept(t),
        "expired-callback": () => accept(""),
        "error-callback": () => accept(""),
      });
    });

    // Hold a submit until the token is ready (capture runs before React's own submit handling).
    const form = box.current.closest("form");
    const onSubmit = (e: SubmitEvent) => {
      if (tokenRef.current || unavailable) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const submitter = e.submitter as HTMLElement | null;
      let done = false;
      const resume = () => {
        if (done || !form) return;
        done = true;
        unavailable = unavailable || !tokenRef.current;
        form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
      };
      waiting.current.push(resume);
      window.setTimeout(resume, WAIT_MS);
    };
    form?.addEventListener("submit", onSubmit, true);

    return () => {
      live = false;
      form?.removeEventListener("submit", onSubmit, true);
      const api = (window as typeof window & { turnstile?: TurnstileApi }).turnstile;
      if (widget && api) api.remove(widget);
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return (
    <div className={className}>
      <div ref={box} />
      <input type="hidden" name={TURNSTILE_FIELD} value={token} readOnly />
    </div>
  );
}
