"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/admin/copy";
import { exchangeForSession, finishWithEmailCode, type EmailCodeStep } from "@/lib/client/firebase";
import { FormAlert } from "./FormAlert";

const LENGTH = 6;

/**
 * The emailed sign-in code (owner, 2026-10-19: no authenticator app, one-time codes only). Shown
 * straight after a password sign-in for roles that need a second step: six large digit boxes with
 * auto-advance, paste of the whole code, the numeric keypad and one-time-code autofill. The ID token
 * from the password step stays in this component's memory only; a reload starts again.
 */
export function CodeForm({
  idToken,
  step: firstStep,
  remember,
  next,
  onCancel,
}: {
  idToken: string;
  step: EmailCodeStep;
  remember: boolean;
  next: string;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<EmailCodeStep>(firstStep);
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mustRestart, setMustRestart] = useState(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, [step]);

  function setFrom(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? "" : x)));
      return;
    }
    setDigits((d) => {
      const out = [...d];
      for (let k = 0; k < clean.length && index + k < LENGTH; k++) out[index + k] = clean[k];
      return out;
    });
    const target = Math.min(LENGTH - 1, index + clean.length);
    boxes.current[target]?.focus();
  }

  function clearBoxes() {
    setDigits(Array(LENGTH).fill(""));
    boxes.current[0]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await finishWithEmailCode(idToken, step, code, { remember, next });
    if (r.ok) {
      // A full load: the admin starts fresh with the new session.
      window.location.assign(r.next);
      return;
    }
    setBusy(false);
    setError(r.message);
    if (r.error === "stale" || r.error === "not_staff" || r.error === "invalid") setMustRestart(true);
    else clearBoxes();
  }

  async function resend() {
    setSending(true);
    setError(null);
    setNotice(null);
    const r = await exchangeForSession(idToken, { remember, next });
    setSending(false);
    if (!r.ok && r.emailCode) {
      setStep(r.emailCode);
      clearBoxes();
      setNotice(`A new code is on its way to ${r.emailCode.emailHint}. Use the newest email.`);
      return;
    }
    if (r.ok) {
      window.location.assign(r.next);
      return;
    }
    setError("That took a little too long. Please sign in again.");
    setMustRestart(true);
  }

  if (mustRestart) {
    return (
      <div className="grid gap-5">
        <FormAlert message={error ?? "Please sign in again."} />
        <Button type="button" variant="forest" icon="arrow-right" onClick={onCancel}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6">
      <fieldset className="grid gap-3">
        <legend className="text-[15px] font-bold text-ink">{COPY["auth.code"]}</legend>
        <p id="code-hint" className="text-[14px] leading-relaxed text-body">
          We emailed a 6-digit code to <span className="font-bold text-ink">{step.emailHint}</span>. Type it here to finish signing in. It works
          for 10 minutes.
        </p>
        <div className="flex justify-between gap-2" role="group" aria-describedby="code-hint">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              onChange={(e) => setFrom(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < LENGTH - 1) boxes.current[i + 1]?.focus();
              }}
              onPaste={(e) => {
                e.preventDefault();
                setFrom(i, e.clipboardData.getData("text"));
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              pattern="[0-9]*"
              maxLength={LENGTH}
              aria-label={`Digit ${i + 1} of ${LENGTH}`}
              disabled={busy}
              className="h-14 w-full min-w-0 max-w-[56px] rounded-2xl border-[1.5px] border-edge bg-white text-center font-grotesk text-[24px] font-semibold tabular-nums text-ink transition-[border-color,box-shadow] focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
            />
          ))}
        </div>
      </fieldset>
      <div>
        <Button type="submit" variant="forest" block icon="arrow-right" loading={busy}>
          {busy ? COPY["auth.signingIn"] : "Continue"}
        </Button>
        <FormAlert message={error} />
        {notice ? (
          <p role="status" className="mt-3 text-[14px] leading-relaxed text-forest">
            {notice}
          </p>
        ) : null}
      </div>
      <p className="text-[14px] leading-relaxed text-body">
        No email? Check your spam folder, or{" "}
        <button type="button" onClick={() => void resend()} disabled={sending || busy} className="font-bold text-forest underline underline-offset-4 disabled:opacity-60">
          {sending ? "sending…" : "send a new code"}
        </button>
        .{" "}
        <button type="button" onClick={onCancel} className="font-bold text-forest underline underline-offset-4">
          Start again
        </button>
      </p>
    </form>
  );
}
