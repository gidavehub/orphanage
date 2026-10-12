import "server-only";

// Selftest suite registry (F1 contract; F2 owns this file from wave 2).
// GET /api/dev/selftest?suite=<name> runs one suite; suite=all (this module's `suite`) runs every
// suite in order and prefixes each case with its suite name.

import type { Suite, SuiteCase } from "../types";
import { suite as ai } from "./ai";
import { suite as auth } from "./auth";
import { suite as content } from "./content";
import { suite as email } from "./email";
import { suite as outbox } from "./outbox";
import { suite as rbac } from "./rbac";
import { suite as refs } from "./refs";
import { suite as retention } from "./retention";
import { suite as seal } from "./seal";
import { suite as store } from "./store";
import { suite as stripe } from "./stripe";
import { suite as workflow } from "./workflow";
import { suite as zoom } from "./zoom";

export const SUITES = {
  store,
  refs,
  seal,
  outbox,
  auth,
  workflow,
  content,
  rbac,
  stripe,
  email,
  ai,
  zoom,
  retention,
} as const satisfies Record<string, Suite>;

export type SuiteName = keyof typeof SUITES;

export const SUITE_NAMES = Object.keys(SUITES) as SuiteName[];

export function getSuite(name: string): Suite | null {
  if (name === "all") return suite;
  return (SUITES as Record<string, Suite>)[name] ?? null;
}

/** Every suite, in order. A suite that throws is reported as one failed case, not a crash. */
export const suite: Suite = {
  name: "all",
  async run(params: URLSearchParams): Promise<SuiteCase[]> {
    const out: SuiteCase[] = [];
    for (const name of SUITE_NAMES) {
      try {
        for (const c of await SUITES[name].run(params)) out.push({ ...c, name: `${name}: ${c.name}` });
      } catch (err) {
        out.push({ name: `${name}: suite crashed`, ok: false, detail: err instanceof Error ? err.message : String(err) });
      }
    }
    return out;
  },
};
