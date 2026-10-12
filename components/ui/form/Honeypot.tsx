"use client";

import { useEffect, useRef } from "react";
import { ELAPSED_FIELD, HONEYPOT_FIELD, SUBMISSION_ID_FIELD } from "@/lib/forms/spam";

/**
 * The anti-spam controls every public form carries (data-model §10.2, D94):
 * - `company_website`: an off-screen text input people never see; any value marks a bot;
 * - `_elapsed`: milliseconds from first render to submit, written into the FormData on submit;
 * - `submissionId` (optional): a client id that makes a double submit idempotent.
 * Place it anywhere inside the `<form>`.
 */
export function Honeypot({ submissionId = true }: { submissionId?: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const started = useRef(0);
  const sid = useRef("");

  useEffect(() => {
    started.current = performance.now();
    if (!sid.current) sid.current = crypto.randomUUID();
    const form = anchor.current?.closest("form");
    if (!form) return;
    // Constructing FormData from the form (which React does for actions) fires `formdata`.
    const onFormData = (e: FormDataEvent) => {
      e.formData.set(ELAPSED_FIELD, String(Math.round(performance.now() - started.current)));
      if (submissionId) e.formData.set(SUBMISSION_ID_FIELD, sid.current);
    };
    form.addEventListener("formdata", onFormData);
    return () => form.removeEventListener("formdata", onFormData);
  }, [submissionId]);

  return (
    <div ref={anchor} aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Company website
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
