import "server-only";

// Selftest runner (PLAN §5.2): GET /api/dev/selftest?suite=<name> → { suite, passed, failed, cases[] }.
// Suites live in lib/server/dev/suites/*.ts; "all" runs every suite. Practice mode only.
// Also the shared helpers suites use: a scratch root under `selftestRuns/{runId}` (deleted at the end,
// so practice data and numbering are never touched) and a tiny case recorder.

import { randomBytes } from "node:crypto";
import { getStore } from "@/lib/server/db";
import { log } from "@/lib/server/log";
import type { SuiteCase, SuiteReport } from "./types";

/** Runs one suite (or "all"). Null for an unknown suite name. A crash becomes one failed case. */
export async function runSelftest(name: string, params: URLSearchParams): Promise<SuiteReport | null> {
  // Loaded lazily: the suites import the helpers below, so a static import would be circular.
  const { getSuite } = await import("./suites");
  const suite = getSuite(name);
  if (!suite) return null;
  let cases: SuiteCase[];
  try {
    cases = await suite.run(params);
  } catch (err) {
    log.error("dev.selftest.crashed", { suite: name, err });
    cases = [{ name: "suite crashed", ok: false, detail: err instanceof Error ? err.message : String(err) }];
  }
  const passed = cases.filter((c) => c.ok).length;
  return { suite: name, passed, failed: cases.length - passed, cases };
}

/** Every suite name, in run order. */
export async function suiteNames(): Promise<string[]> {
  return [...(await import("./suites")).SUITE_NAMES];
}

/** A scratch root ("selftestRuns/<id>") for one suite run. */
export function scratchRoot(): string {
  return `selftestRuns/${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

/** Deletes a scratch root and everything under it. Never throws. */
export async function dropScratch(root: string): Promise<void> {
  try {
    await getStore().delete(root, { recursive: true });
  } catch (err) {
    log.warn("dev.selftest.cleanup_failed", { root, err });
  }
}

/** Collects cases: `await t.check(name, async () => …)` records ok/fail with the thrown message. */
export function caseRecorder() {
  const cases: SuiteCase[] = [];
  return {
    cases,
    /** Passes when `fn` returns true (or a detail string) and does not throw. */
    async check(name: string, fn: () => Promise<boolean | string> | boolean | string): Promise<boolean> {
      try {
        const r = await fn();
        const ok = r === true || typeof r === "string";
        cases.push({ name, ok, ...(typeof r === "string" ? { detail: r } : ok ? {} : { detail: "expectation not met" }) });
        return ok;
      } catch (err) {
        cases.push({ name, ok: false, detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
        return false;
      }
    },
    /** Passes when `fn` throws an error of class `ctor` (optionally matching `message`). */
    async throws(name: string, ctor: abstract new (...args: never[]) => Error, fn: () => Promise<unknown> | unknown, message?: RegExp): Promise<boolean> {
      try {
        await fn();
        cases.push({ name, ok: false, detail: `expected ${ctor.name}, nothing was thrown` });
        return false;
      } catch (err) {
        const ok = err instanceof ctor && (!message || message.test((err as Error).message));
        cases.push({ name, ok, ...(ok ? {} : { detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }) });
        return ok;
      }
    },
  };
}
