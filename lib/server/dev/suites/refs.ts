import "server-only";

// Selftest suite "refs" (F2): case references (data-model §3, PLAN D74). Gap-free sequenced references
// under 20 concurrent creates, no number lost when a create fails, receipts and sponsor codes, random
// concern references, and normaliseRef. Runs under a scratch root, so real numbering is untouched.

import { CONCERN_REF_RE, RECEIPT_RE, SPONSOR_RE, normaliseRef } from "@/lib/model/refs";
import { getStore } from "@/lib/server/db";
import { createConcernWithRandomRef, createWithReference, nextReceiptNumber, nextSponsorCode, randomConcernRef, referenceYear } from "@/lib/server/references";
import { caseRecorder, dropScratch, scratchRoot } from "../selftest";
import type { Suite } from "../types";

export const suite: Suite = {
  name: "refs",
  async run() {
    const t = caseRecorder();
    const root = scratchRoot();
    const year = referenceYear();
    const pad = (n: number) => String(n).padStart(4, "0");
    try {
      await t.check("20 concurrent creates get HVN-SR-YYYY-0001…0020 with no gaps or repeats", async () => {
        const refs = await Promise.all(
          Array.from({ length: 20 }, (_, i) => createWithReference("supportRequests", (reference, now) => ({ reference, n: i, createdAt: now }), undefined, { root })),
        );
        const sorted = [...refs].sort();
        const expected = Array.from({ length: 20 }, (_, i) => `HVN-SR-${year}-${pad(i + 1)}`);
        if (JSON.stringify(sorted) !== JSON.stringify(expected)) throw new Error(`got ${sorted.join(",")}`);
        const ids = await getStore().listIds(`${root}/supportRequests`);
        if (ids.length !== 20) throw new Error(`${ids.length} records`);
        return true;
      });

      await t.check("a create that fails consumes no number (gap-free)", async () => {
        try {
          await createWithReference(
            "supportRequests",
            (reference) => ({ reference }),
            () => {
              throw new Error("boom");
            },
            { root },
          );
        } catch {
          // expected
        }
        const next = await createWithReference("supportRequests", (reference) => ({ reference }), undefined, { root });
        if (next !== `HVN-SR-${year}-0021`) throw new Error(`next was ${next}`);
        return true;
      });

      await t.check("each sequenced collection keeps its own counter", async () => {
        const dn = await createWithReference("donations", (reference) => ({ reference }), undefined, { root });
        return dn === `HVN-DN-${year}-0001`;
      });

      await t.check("receipt numbers are sequential, also twice in one transaction", async () => {
        const [a, b] = await getStore().runTransaction(async (tx) => {
          const first = await nextReceiptNumber(tx, year, { root });
          return [first, await nextReceiptNumber(tx, year, { root })];
        });
        const c = await getStore().runTransaction((tx) => nextReceiptNumber(tx, year, { root }));
        if (!RECEIPT_RE.test(a) || a !== `HVN-RC-${year}-0001` || b !== `HVN-RC-${year}-0002` || c !== `HVN-RC-${year}-0003`) throw new Error(`${a} ${b} ${c}`);
        return true;
      });

      await t.check("sponsor codes are HVN-SP-NNNN", async () => {
        const code = await getStore().runTransaction((tx) => nextSponsorCode(tx, { root }));
        return SPONSOR_RE.test(code) && code === "HVN-SP-0001";
      });

      await t.check("random concern references: format, no I L O U, no repeats in 500", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 500; i++) {
          const r = randomConcernRef();
          if (!CONCERN_REF_RE.test(r) || /[ILOU]/.test(r.slice(4))) throw new Error(`bad ${r}`);
          seen.add(r);
        }
        return seen.size === 500;
      });

      await t.check("a concern is created under a random reference", async () => {
        const ref = await createConcernWithRandomRef((reference) => ({ reference }), undefined, { root });
        const doc = await getStore().get(`${root}/safeguardingConcerns/${ref}`);
        return CONCERN_REF_RE.test(ref) && doc !== null;
      });

      await t.check("normaliseRef understands what staff type", () => {
        const cases: Array<[string, string | null]> = [
          ["sr 2026 12", "HVN-SR-2026-0012"],
          ["SR-2026-12", "HVN-SR-2026-0012"],
          ["hvn-sr-2026-0012", "HVN-SR-2026-0012"],
          ["k7q2m9xd", "HVN-K7Q2-M9XD"],
          ["rc 2026 17", "HVN-RC-2026-0017"],
          ["sp 12", "HVN-SP-0012"],
          ["hello world", null],
        ];
        const bad = cases.filter(([input, want]) => normaliseRef(input) !== want);
        if (bad.length) throw new Error(bad.map(([i]) => `${i} → ${normaliseRef(i)}`).join("; "));
        return true;
      });
    } finally {
      await dropScratch(root);
    }
    return t.cases;
  },
};
