"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/form/Segmented";
import { Textarea } from "@/components/ui/form/Textarea";
import { useToast } from "@/components/ui/Toast";
import { COPY } from "@/lib/admin/copy";
import { cn } from "@/lib/cn";

export type ComposerMode = "note" | "call" | "email" | "referral" | "followup" | "contact";

export type ComposerResult = { ok: true; message?: string } | { ok: false; message: string };

const MODE_LABEL: Record<ComposerMode, string> = {
  note: "Note",
  call: "Log a call",
  email: "Email",
  referral: "Referral",
  followup: "Follow-up",
  contact: "Contact",
};

const PLACEHOLDER: Record<ComposerMode, string> = {
  note: "Write a note for the team…",
  call: "Who you spoke to and what was agreed…",
  email: "Write the message…",
  referral: "Where you referred them and why…",
  followup: "What happens next, and when…",
  contact: "How you got in touch…",
};

export type ComposerProps = {
  /** The record reference: drafts are kept per record and mode. */
  reference: string;
  modes: ComposerMode[];
  /** The Server Action wrapper: it checks permission, seals the text where needed, and saves. */
  onSubmit: (input: { mode: ComposerMode; text: string }) => Promise<ComposerResult>;
  /**
   * Sensitive records (concerns, counselling, support explanations): nothing is ever written to
   * browser storage, so a draft cannot outlive the page on a shared device.
   */
  sensitive?: boolean;
  /** 4,000 for case notes, 1,000 for counsellor notes (data-model §4.1). */
  maxLength?: number;
  /** A short hint under the box (the counsellor-notes reminder). */
  hint?: string;
  className?: string;
};

function storageKey(reference: string, mode: ComposerMode) {
  return `composer:${reference}:${mode}`;
}

function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, text: string) {
  try {
    if (text) window.sessionStorage.setItem(key, text);
    else window.sessionStorage.removeItem(key);
  } catch {
    // storage full or blocked: the text stays in the box
  }
}

/**
 * Notes, calls and messages on a record (admin-ux §9.2 Composer; PLAN §5.5). Non-sensitive drafts
 * survive a reload or going offline in sessionStorage (`composer:<ref>:<mode>`), cleared on send and
 * on sign-out; sensitive records keep nothing in storage. Ctrl/Cmd+Enter sends. The server decides.
 */
export function Composer({ reference, modes, onSubmit, sensitive, maxLength = 4000, hint, className }: ComposerProps) {
  const [mode, setMode] = useState<ComposerMode>(modes[0] ?? "note");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const boxId = useId();
  const hintId = useId();
  const loaded = useRef<string | null>(null);

  // Restore this mode's draft (client only, non-sensitive records only).
  useEffect(() => {
    const key = storageKey(reference, mode);
    if (sensitive || loaded.current === key) return;
    loaded.current = key;
    setText(readDraft(key));
  }, [reference, mode, sensitive]);

  const change = (value: string) => {
    setText(value);
    setError(null);
    if (!sensitive) writeDraft(storageKey(reference, mode), value);
  };

  const send = () => {
    const body = text.trim();
    if (!body) {
      setError("Please write something first.");
      return;
    }
    if (body.length > maxLength) {
      setError(`Please keep this to ${maxLength.toLocaleString("en-GB")} characters.`);
      return;
    }
    startTransition(async () => {
      try {
        const result = await onSubmit({ mode, text: body });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setText("");
        if (!sensitive) writeDraft(storageKey(reference, mode), "");
        toast({ title: result.message ?? "Added", tone: "success" });
      } catch {
        setError(navigator.onLine === false ? COPY["error.network"] : COPY["error.server"]);
      }
    });
  };

  const over = text.length > maxLength;

  return (
    <div className={cn("grid gap-3 rounded-control bg-white p-4 shadow-soft md:p-5", className)}>
      {modes.length > 1 ? (
        <Segmented<ComposerMode>
          label="What are you adding?"
          options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          skin="donat"
          density="admin"
          className="w-fit max-w-full"
        />
      ) : null}
      <label htmlFor={boxId} className="sr-only">
        {MODE_LABEL[mode]}
      </label>
      <Textarea
        id={boxId}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={PLACEHOLDER[mode]}
        density="admin"
        rows={3}
        invalid={!!error || over}
        aria-describedby={[hint ? hintId : null, error ? `${boxId}-error` : null].filter(Boolean).join(" ") || undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={hint ? hintId : undefined} className="min-w-0 flex-1 text-[13px] leading-snug text-body">
          {hint ?? (sensitive ? "Nothing you type here is saved on this device until you add it." : "Ctrl + Enter adds it.")}
        </p>
        <span className={cn("font-grotesk text-[12px] tabular-nums", over ? "font-semibold text-coral-800" : "text-body")}>
          {text.length.toLocaleString("en-GB")} / {maxLength.toLocaleString("en-GB")}
        </span>
        <Button type="button" size="sm" variant="forest" icon="none" loading={pending} onClick={send}>
          <span className="inline-flex items-center gap-2">
            <Send aria-hidden className="size-4" strokeWidth={2.25} /> {mode === "email" ? "Send" : "Add"}
          </span>
        </Button>
      </div>
      {error ? (
        <p id={`${boxId}-error`} role="alert" className="text-[14px] font-semibold text-coral-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
