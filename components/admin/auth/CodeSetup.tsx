"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/Button";
import { cancelCodeSetup, exchangeForSession, finishCodeSetup, signInWithPassword, startCodeSetup } from "@/lib/client/firebase";
import { FormAlert } from "./FormAlert";

/**
 * First sign-in for a role that needs a code (PLAN D88): after the password, the person adds Haven to
 * an authenticator app (QR code, the key to type, or a tap on a phone), confirms one 6-digit code to
 * save it on the account, and then signs in with the code as they will every time from now on.
 */
export function CodeSetup({ email, password, remember, next, onCancel }: { email: string; password: string; remember: boolean; next: string; onCancel: () => void }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secretKey: string; uri: string; svg: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startCodeSetup(email, password).then((r) => {
      if (r.kind === "error") setError(r.message);
      else setSetup({ secretKey: r.secretKey, uri: r.uri, svg: renderSVG(r.uri, { border: 2 }) });
    });
  }, [email, password]);

  useEffect(() => {
    if (setup) input.current?.focus();
  }, [setup]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Please enter the 6-digit code from your app.");
      return;
    }
    setBusy(true);
    setError(null);
    const saved = await finishCodeSetup(digits);
    if (saved.kind === "error") {
      setBusy(false);
      setError(saved.message);
      setCode("");
      input.current?.focus();
      return;
    }
    // Saved. Sign in the way it works from now on: password, then the code that's showing now.
    const again = await signInWithPassword(email, password);
    if (again.kind === "code_required") {
      const q = new URLSearchParams({ next, setup: "1", ...(remember ? { remember: "1" } : {}) });
      router.push(`/admin/login/code?${q.toString()}`);
      return;
    }
    if (again.kind === "ok") {
      const session = await exchangeForSession(again.idToken, { remember, next });
      if (session.ok) {
        window.location.assign(session.next);
        return;
      }
      setError(session.message);
    } else setError(again.message);
    setBusy(false);
  }

  function cancel() {
    void cancelCodeSetup();
    onCancel();
  }

  if (!setup) {
    return (
      <div className="grid gap-5" aria-busy={!error}>
        <p className="text-[16px] leading-relaxed text-body">{error ? "We couldn't start setting up your sign-in code." : "Getting your sign-in code ready…"}</p>
        <FormAlert message={error} />
        {error ? (
          <Button type="button" variant="forest" icon="none" onClick={cancel}>
            Back to sign in
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <h2 className="text-[20px] font-extrabold leading-snug text-ink">Set up your sign-in code</h2>
        <p className="text-[15px] leading-relaxed text-body">
          Your role looks after children&apos;s safety or donors&apos; money, so Haven asks for a 6-digit code from an authenticator app each time you sign in. Google Authenticator,
          Microsoft Authenticator or 1Password all work.
        </p>
      </div>
      <ol className="grid gap-5 text-[15px] leading-relaxed text-ink">
        <li className="grid gap-3">
          <span>
            <strong>1.</strong> In the app, add an account and scan this code.
          </span>
          <div
            role="img"
            aria-label="QR code that adds Haven to your authenticator app"
            className="size-[200px] rounded-2xl bg-white p-2 ring-1 ring-line [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: setup.svg }}
          />
          <span className="text-[14px] text-body">
            On this phone?{" "}
            <a href={setup.uri} className="font-bold text-forest underline underline-offset-4">
              Open it in your authenticator app
            </a>
            . Or type this key:
          </span>
          <code className="w-fit select-all break-all rounded-xl bg-cream px-3 py-2 font-grotesk text-[15px] font-semibold tracking-[0.08em] text-ink">
            {setup.secretKey.match(/.{1,4}/g)?.join(" ")}
          </code>
        </li>
        <li className="grid gap-3">
          <label htmlFor="setup-code">
            <strong>2.</strong> Enter the 6-digit code the app shows for Haven.
          </label>
          <input
            ref={input}
            id="setup-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            disabled={busy}
            className="h-14 w-full max-w-[220px] rounded-2xl border-[1.5px] border-edge bg-white text-center font-grotesk text-[24px] font-semibold tracking-[0.3em] tabular-nums text-ink transition-[border-color,box-shadow] focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
          />
        </li>
      </ol>
      <div>
        <Button type="submit" variant="forest" block icon="arrow-right" loading={busy}>
          {busy ? "Saving your code…" : "Save my code"}
        </Button>
        <FormAlert message={error} />
      </div>
      <p className="text-[14px] leading-relaxed text-body">
        Then you&apos;ll sign in once more with the newest code.{" "}
        <button type="button" onClick={cancel} className="font-bold text-forest underline underline-offset-4">
          Cancel
        </button>
      </p>
    </form>
  );
}
