import "server-only";

// Selftest suite "outbox" (F2): enqueue → drain → held + preview (+ the local mailbox file), dedupe,
// subject rules (a name in the subject is refused), sealed vars, cancellation, and every template
// rendering with a subject that matches its pattern. Test records use selftest-only keys and are
// deleted at the end.

import { randomBytes } from "node:crypto";
import { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES } from "@/lib/model/email";
import type { OutboxEmail } from "@/lib/model/domain/system";
import { getStore } from "@/lib/server/db";
import { cancelEmail, deliverOutboxItem, enqueueEmail, EmailSubjectError, outboxPath } from "@/lib/server/email/outbox";
import { emailMode } from "@/lib/server/email/provider";
import { renderEmail } from "@/lib/server/email/render";
import { getTemplate, sampleVars } from "@/lib/server/email/templates";
import { readMailboxFile, removeMailboxFile } from "@/lib/server/email/transports/mailbox";
import { SUBJECT_RE } from "@/lib/server/email/types";
import { resolveBackend } from "@/lib/server/env";
import { isSealed } from "@/lib/server/security/seal";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

const CATEGORY_WORDS = /\b(counsell?ing|medical|legal|school fees|abuse|neglect|safeguarding|child protection|concern)\b/i;

export const suite: Suite = {
  name: "outbox",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const run = `selftest-${randomBytes(4).toString("hex")}`;
    const created: string[] = [];
    const year = new Date().getUTCFullYear();
    try {
      await t.check(`email mode is ${emailMode()}`, () => `mode=${emailMode()}`);

      let firstId = "";
      await t.check("enqueue → queued record with a fixed subject", async () => {
        const { id, deduped } = await enqueueEmail({ template: "email_test", to: ["selftest@example.org"], dedupeKey: run });
        created.push(id);
        firstId = id;
        const doc = await store.get<OutboxEmail>(outboxPath(id));
        return !deduped && doc?.status === "queued" && doc.subject === "Haven test email" && doc.to[0] === "selftest@example.org";
      });
      await t.check("the same dedupe key is not queued twice", async () => {
        const { deduped } = await enqueueEmail({ template: "email_test", to: ["selftest@example.org"], dedupeKey: run });
        return deduped;
      });
      await t.check("drain → held with a preview (nothing sent)", async () => {
        const status = await deliverOutboxItem(firstId);
        const doc = await store.get<OutboxEmail>(outboxPath(firstId));
        const ok = status === "held" && doc?.status === "held" && (doc.preview?.html.includes("Haven test email") ?? false) && (doc.preview?.text.length ?? 0) > 20;
        if (!ok) throw new Error(`status=${status} stored=${doc?.status} lastError=${doc?.lastError}`);
        return true;
      });
      if (resolveBackend() === "local") {
        await t.check("held email written to .data/mailbox/<id>.html", async () => {
          const html = await readMailboxFile(firstId);
          return html !== null && html.includes("NOT sent") && html.includes("Haven test email");
        });
      }

      await t.throws("a subject with a name in it is refused", EmailSubjectError, () =>
        enqueueEmail({ template: "support_confirmation", to: ["selftest@example.org"], vars: { reference: "Fatou Ceesay", firstName: "Fatou" }, dedupeKey: `${run}-name` }),
      );
      await t.throws("a template that needs a reference refuses to send without one", EmailSubjectError, () =>
        enqueueEmail({ template: "support_confirmation", to: ["selftest@example.org"], vars: { firstName: "Awa" }, dedupeKey: `${run}-noref` }),
      );

      await t.check("vars beyond reference, first name and links are sealed; drain still renders them", async () => {
        const reference = `HVN-AP-${year}-9999`;
        const { id } = await enqueueEmail({
          template: "counselling_confirmation",
          to: ["selftest@example.org"],
          vars: { reference, firstName: "Awa", when: "Tuesday 14 October, 10:00 (Banjul time)", link: "https://zoom.us/j/1000000001" },
          dedupeKey: `${reference}~${run}`,
        });
        created.push(id);
        const stored = await store.get<OutboxEmail>(outboxPath(id));
        const sealed = isSealed(stored?.vars);
        const status = await deliverOutboxItem(id);
        const after = await store.get<OutboxEmail>(outboxPath(id));
        const ok = sealed && status === "held" && (after?.preview?.html.includes("Tuesday 14 October") ?? false) && after?.subject === `Your Haven appointment is confirmed (${reference})`;
        if (!ok) throw new Error(`sealed=${sealed} status=${status}`);
        return true;
      });

      await t.check("cancelling a queued email", async () => {
        const { id } = await enqueueEmail({
          template: "email_test",
          to: ["selftest@example.org"],
          dedupeKey: `${run}-cancel`,
          scheduledFor: Date.now() + 86_400_000,
        });
        created.push(id);
        const result = await cancelEmail(id);
        const doc = await store.get<OutboxEmail>(outboxPath(id));
        return result === "cancelled" && doc?.status === "cancelled";
      });

      await t.check(`all ${EMAIL_TEMPLATE_IDS.length} templates render; subjects match their patterns`, () => {
        const bad: string[] = [];
        for (const id of EMAIL_TEMPLATE_IDS) {
          const def = getTemplate(id);
          const vars = sampleVars(id);
          const subject = def.subject(vars);
          if (!SUBJECT_RE.test(subject) || !def.subjectPattern.test(subject)) bad.push(`${id}: "${subject}"`);
          const { html, text } = renderEmail(def.build(vars, {}), { baseUrl: "http://localhost:3001" });
          if (!html.includes("<html lang=\"en\">") || text.length < 20) bad.push(`${id}: render`);
        }
        if (bad.length) throw new Error(bad.join("; "));
        return true;
      });
      await t.check("sensitive templates name no category of need and carry the emergency block when public", () => {
        const bad: string[] = [];
        for (const id of SENSITIVE_EMAIL_TEMPLATES) {
          const def = getTemplate(id);
          const vars = sampleVars(id);
          const { text } = renderEmail(def.build(vars, {}), { baseUrl: "http://localhost:3001" });
          const subject = def.subject(vars);
          if (CATEGORY_WORDS.test(subject) || CATEGORY_WORDS.test(text)) bad.push(`${id}: category word`);
          if (def.audience === "public" && !text.includes("immediate danger")) bad.push(`${id}: no emergency block`);
        }
        if (bad.length) throw new Error(bad.join("; "));
        return true;
      });
    } finally {
      for (const id of created) {
        await store.delete(outboxPath(id)).catch(() => undefined);
        await removeMailboxFile(id).catch(() => undefined);
      }
    }
    return t.cases;
  },
};
