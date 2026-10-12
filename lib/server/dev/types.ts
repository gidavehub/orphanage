import "server-only";

// Selftest contracts: GET /api/dev/selftest?suite=<name> runs one suite and returns
// { suite, passed, failed, cases[] }. Suites live in lib/server/dev/suites/<name>.ts.

export type SuiteCase = { name: string; ok: boolean; detail?: string };

export type Suite = {
  name: string;
  /** Query parameters from the selftest route (e.g. ?case=, ?reset=1). */
  run(params: URLSearchParams): Promise<SuiteCase[]>;
};

export type SuiteReport = { suite: string; passed: number; failed: number; cases: SuiteCase[] };
