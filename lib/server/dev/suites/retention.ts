import "server-only";

// Selftest suite "retention" (PLAN §6.3 I6): under a scratch root, a dry run lists what is due without
// changing anything; a real run deletes an old contact message, anonymises an old gift, keeps a recent
// one, never deletes a safeguarding concern (it is flagged for a person to review), respects a legal
// hold, and purges old email bodies while keeping the log line.

import { getStore } from "@/lib/server/db";
import { runRetention } from "@/lib/server/retention";
import { caseRecorder, dropScratch, scratchRoot } from "../selftest";
import type { Suite } from "../types";

const DAY = 86_400_000;

export const suite: Suite = {
  name: "retention",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const root = scratchRoot();
    const now = Date.now();
    const years = (n: number) => now - n * 365 * DAY;
    const base = { createdAt: years(12), updatedAt: years(12), version: 1 };
    try {
      await store.batch((b) => {
        b.set(`${root}/contactMessages/HVN-CM-2015-0001`, { ...base, status: "closed", closedAt: years(10), retention: { policy: "contact", retainUntil: null, legalHold: false } });
        b.set(`${root}/contactMessages/HVN-CM-2026-0001`, { ...base, createdAt: now - 10 * DAY, status: "closed", closedAt: now - 5 * DAY, retention: { policy: "contact", retainUntil: null, legalHold: false } });
        b.set(`${root}/contactMessages/HVN-CM-2015-0002`, { ...base, status: "closed", closedAt: years(10), retention: { policy: "contact", retainUntil: null, legalHold: true } });
        b.set(`${root}/safeguardingConcerns/HVN-AAAA-BBBB`, { ...base, status: "closed", closedAt: years(11), retention: { policy: "concern", retainUntil: null, legalHold: false } });
        b.set(`${root}/donations/HVN-DN-2015-0001`, { ...base, status: "completed", receivedAt: years(11), donor: { fullName: "Old Donor", email: "old@example.org", emailLower: "old@example.org", phone: "+2201234567", organisationName: null }, comments: "A note", retention: { policy: "donation.financial", retainUntil: null, legalHold: false } });
        b.set(`${root}/emailOutbox/support_confirmation~HVN-SR-2015-0001`, { ...base, createdAt: now - 120 * DAY, template: "support_confirmation", vars: { firstName: "A" }, preview: { html: "<p>x</p>", text: "x" }, bodyPurgedAt: null, status: "sent" });
      });

      await t.check("a dry run lists what is due and changes nothing", async () => {
        const r = await runRetention({ dryRun: true, scope: { root }, now });
        const paths = r.due.map((d) => d.path);
        const still = await store.get(`${root}/contactMessages/HVN-CM-2015-0001`);
        const ok = r.dryRun && paths.includes("contactMessages/HVN-CM-2015-0001") && paths.includes("safeguardingConcerns/HVN-AAAA-BBBB") && !paths.includes("contactMessages/HVN-CM-2026-0001") && Boolean(still) && r.deleted === 0;
        if (!ok) throw new Error(`due=${paths.join(",")} still=${Boolean(still)}`);
        return true;
      });

      await t.check("concerns are only ever flagged for review", async () => {
        const r = await runRetention({ dryRun: true, scope: { root }, now });
        const c = r.due.find((d) => d.path.startsWith("safeguardingConcerns/"));
        return c?.mode === "review" ? true : `mode=${c?.mode}`;
      });

      await t.check("a real run deletes, anonymises and flags, as set", async () => {
        const r = await runRetention({ scope: { root }, now });
        const oldMsg = await store.get(`${root}/contactMessages/HVN-CM-2015-0001`);
        const recent = await store.get(`${root}/contactMessages/HVN-CM-2026-0001`);
        const held = await store.get(`${root}/contactMessages/HVN-CM-2015-0002`);
        const concern = await store.get<{ retention: { reviewNotifiedAt?: number } }>(`${root}/safeguardingConcerns/HVN-AAAA-BBBB`);
        const gift = await store.get<{ donor: { fullName: string; email: string }; comments: string | null }>(`${root}/donations/HVN-DN-2015-0001`);
        const ok = !oldMsg && Boolean(recent) && Boolean(held) && Boolean(concern?.retention.reviewNotifiedAt) && gift?.donor.fullName === "Anonymised donor" && gift.donor.email === "" && gift.comments === null && r.held >= 1;
        if (!ok) throw new Error(`deleted=${!oldMsg} recent=${Boolean(recent)} held=${Boolean(held)} concernFlag=${concern?.retention.reviewNotifiedAt} gift=${gift?.donor.fullName}`);
        return true;
      });

      await t.check("old email bodies are purged, the log line stays", async () => {
        const e = await store.get<{ vars: unknown; preview: unknown; bodyPurgedAt: number | null; template: string }>(`${root}/emailOutbox/support_confirmation~HVN-SR-2015-0001`);
        return e && e.vars === null && e.preview === null && Boolean(e.bodyPurgedAt) && e.template === "support_confirmation" ? true : `vars=${JSON.stringify(e?.vars)}`;
      });
    } finally {
      await dropScratch(root);
    }
    return t.cases;
  },
};
