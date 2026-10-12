"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/admin/copy";
import { clearPendingCode, exchangeForSession, hasPendingCode, resolveSignInCode } from "@/lib/client/firebase";
import { FormAlert } from "./FormAlert";

const LENGTH = 6;

/**
 * The sign-in code step (admin-ux §6.1; PLAN D88): six large digit boxes with auto-advance, paste of
 * the whole code, the numeric keypad and one-time-code autofill. Completes the Firebase sign-in that
 * /admin/login parked in memory, then exchanges the token for a session and reloads into the admin.
 * There are no backup codes (Identity Platform TOTP has none): recovery is a super-admin reset.
 */
export function CodeForm({ next, remember, justSetUp = false }: { next: string; remember: boolean; justSetUp?: boolean }) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    // Module state only exists in this tab's memory; after a reload the sign-in starts again.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (client-only state)
    setPending(hasPendingCode());
  }, []);

  useEffect(() => {
    if (pending) boxes.current[0]?.focus();
  }, [pending]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await resolveSignInCode(code);
    if (result.kind !== "ok") {
      setBusy(false);
      setError(result.kind === "error" ? result.message : "Please sign in again.");
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
      return;
    }
    const session = await exchangeForSession(result.idToken, { remember, next });
    if (!session.ok) {
      setBusy(false);
      setError(session.message);
      return;
    }
    window.location.assign(session.next);
  }

  if (pending === false) {
    return (
      <div className="grid gap-5">
        <p className="text-[16px] leading-relaxed text-body">This step only works straight after you sign in with your password. Please sign in again.</p>
        <Button href={`/admin/login?next=${encodeURIComponent(next)}`} variant="forest" icon="arrow-right">
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
          {justSetUp ? "Your sign-in code is saved. Enter the newest code your app shows for Haven to finish signing in." : COPY["auth.codeHint"]}
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
              disabled={busy || pending === null}
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
      </div>
      <p className="text-[14px] leading-relaxed text-body">
        Lost your phone or authenticator? A super admin can reset your sign-in code.{" "}
        <Link href="/admin/login" onClick={() => clearPendingCode()} className="font-bold text-forest underline underline-offset-4">
          Start again
        </Link>
      </p>
    </form>
  );
}
