"use client";

import { useEffect, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/Button";
import { cancelCodeSetup, exchangeForSession, finishCodeSetup, startCodeSetup } from "@/lib/client/firebase";
import { FormAlert } from "./FormAlert";

type Ready = { secretKey: string; uri: string; svg: string; accountName: string; deadline: number };

/**
 * First sign-in for a role that needs a code (PLAN D88): after the password, the person adds Haven to
 * an authenticator app (QR code, the key to type, or a tap on a phone) and confirms one 6-digit code.
 * Saving it signs them straight in: there is no second code to type. The same QR code stays for every
 * retry; only after Identity Platform's 15-minute limit is there a new one (and the old app entry
 * must go).
 */
export function CodeSetup({ email, password, remember, next, onCancel }: { email: string; password: string; remember: boolean; next: string; onCancel: () => void }) {
  const [setup, setSetup] = useState<Ready | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasCode, setHasCode] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function begin() {
    setSetup(null);
    setCode("");
    const r = await startCodeSetup(email, password);
    if (r.kind === "ok") setSetup({ secretKey: r.secretKey, uri: r.uri, svg: renderSVG(r.uri, { border: 2 }), accountName: r.accountName, deadline: r.deadline });
    else {
      setHasCode(r.kind === "has_code");
      setError(r.message);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; retries call begin() themselves
  }, []);

  useEffect(() => {
    if (setup) input.current?.focus();
  }, [setup]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

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
    if (saved.kind === "ok") {
      const session = await exchangeForSession(saved.idToken, { remember, next });
      if (session.ok) {
        window.location.assign(session.next);
        return;
      }
      setBusy(false);
      setError(`Your code is saved. ${session.message} Sign in with your password and the code from your app.`);
      setHasCode(true);
      return;
    }
    setBusy(false);
    if (saved.kind === "expired") {
      setNotice(`${saved.message} First delete the old “Haven” entry from your app.`);
      await begin();
      return;
    }
    if (saved.kind === "has_code") setHasCode(true);
    setError(saved.message);
    setCode("");
    input.current?.focus();
  }

  function back() {
    void cancelCodeSetup();
    onCancel();
  }

  if (hasCode) {
    return (
      <div className="grid gap-5">
        <FormAlert message={error} />
        <Button type="button" variant="forest" icon="arrow-right" onClick={back}>
          Sign in with my code
        </Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="grid gap-5" aria-busy={!error}>
        <p className="text-[16px] leading-relaxed text-body">{error ? "We couldn't start setting up your sign-in code." : "Getting your sign-in code ready…"}</p>
        <FormAlert message={error} />
        {error ? (
          <Button type="button" variant="forest" icon="none" onClick={back}>
            Back to sign in
          </Button>
        ) : null}
      </div>
    );
  }

  const minutesLeft = Math.max(0, Math.ceil((setup.deadline - now) / 60_000));

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <h2 className="text-[20px] font-extrabold leading-snug text-ink">Set up your sign-in code</h2>
        <p className="text-[15px] leading-relaxed text-body">
          Your role looks after children&apos;s safety or donors&apos; money, so Haven asks for a 6-digit code from an authenticator app each time you sign in. Google Authenticator,
          Microsoft Authenticator or 1Password all work.
        </p>
      </div>
      {notice ? <p className="rounded-2xl bg-sand px-4 py-3 text-[14px] font-semibold leading-snug text-umber">{notice}</p> : null}
      <ol className="grid gap-5 text-[15px] leading-relaxed text-ink">
        <li className="grid gap-3">
          <span>
            <strong>1.</strong> In the app, tap <strong>+</strong> and scan this QR code. If Haven is already in your app from an earlier try, delete that entry first.
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
            . Or choose &ldquo;Enter a setup key&rdquo; in the app and type this key (time-based):
          </span>
          <code className="w-fit select-all break-all rounded-xl bg-cream px-3 py-2 font-grotesk text-[15px] font-semibold tracking-[0.08em] text-ink">
            {setup.secretKey.match(/.{1,4}/g)?.join(" ")}
          </code>
        </li>
        <li className="grid gap-3">
          <label htmlFor="setup-code">
            <strong>2.</strong> Enter the 6-digit code the app shows under <strong>Haven ({setup.accountName})</strong>.
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
            aria-describedby="setup-code-hint"
            className="h-14 w-full max-w-[220px] rounded-2xl border-[1.5px] border-edge bg-white text-center font-grotesk text-[24px] font-semibold tracking-[0.3em] tabular-nums text-ink transition-[border-color,box-shadow] focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
          />
          <span id="setup-code-hint" className="text-[14px] text-body">
            The code changes every 30 seconds; any current one works.{minutesLeft > 0 ? ` Please finish within ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` : ""}
          </span>
        </li>
      </ol>
      <div>
        <Button type="submit" variant="forest" block icon="arrow-right" loading={busy}>
          {busy ? "Saving and signing you in…" : "Save my code and sign in"}
        </Button>
        <FormAlert message={error} />
      </div>
      <p className="text-[14px] leading-relaxed text-body">
        From now on you&apos;ll sign in with your password and a code from this app. Lost your phone later? A super admin can reset your code.{" "}
        <button type="button" onClick={back} className="font-bold text-forest underline underline-offset-4">
          Cancel
        </button>
      </p>
    </form>
  );
}
