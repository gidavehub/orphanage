"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/forms/types";

export type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "invalid"; fields: Record<string, string> } | { kind: "conflict"; message: string } | { kind: "error"; message: string };

/**
 * Draft autosave for the studio (admin-ux §6.10: 800 ms after typing stops). Saves never overlap: a
 * change made while a save is in flight is saved right after it, with the new version, so our own
 * saves never conflict with each other. `save` gets the version to build on and returns the next.
 */
export function useAutosave<T>(initialVersion: number, save: (value: T, baseVersion: number) => Promise<ActionResult<{ version: number }>>, onSaved?: (version: number) => void, delay = 800) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const version = useRef(initialVersion);
  const latest = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
  });

  const run = async () => {
    if (latest.current === null) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    setState({ kind: "saving" });
    const value = latest.current;
    const r = await saveRef.current(value, version.current);
    inflight.current = false;
    if (r.ok) {
      version.current = r.data.version;
      setState({ kind: "saved" });
      onSavedRef.current?.(r.data.version);
    } else if (r.error.kind === "validation") setState({ kind: "invalid", fields: r.error.fields });
    else if (r.error.kind === "conflict") setState({ kind: "conflict", message: r.error.message });
    else setState({ kind: "error", message: "message" in r.error ? r.error.message : "That didn't save." });
    if (again.current && r.ok) {
      again.current = false;
      void run();
    }
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    state,
    version,
    /** Call on every change. */
    change(value: T) {
      latest.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), delay);
    },
    /** Saves at once (closing the sheet). */
    async flush() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        await run();
      }
    },
  };
}
