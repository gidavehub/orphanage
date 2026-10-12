import "server-only";

// Selftest suite "email" (PLAN §6.3 I3): every template renders with sample values; every subject
// matches the global rule and its own pattern; private templates name no category of need; editable
// wording accepts only {firstName} and {ref}; updates (and only updates) carry unsubscribe; Reply-To
// follows the team mailboxes; without RESEND_API_KEY nothing can be sent (mailbox mode).

import { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES } from "@/lib/model/email";
import { env } from "@/lib/server/env";
import { categoryWordIn, copyProblems, previewEmail, sampleVars } from "@/lib/server/email/copy";
import { emailMode, replyToFor } from "@/lib/server/email/provider";
import { renderEmail } from "@/lib/server/email/render";
import { getTemplate } from "@/lib/server/email/templates";
import { SUBJECT_RE } from "@/lib/server/email/types";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

export const suite: Suite = {
  name: "email",
  async run() {
    const t = caseRecorder();

    await t.check(`all ${EMAIL_TEMPLATE_IDS.length} templates render with sample details`, () => {
      const bad: string[] = [];
      for (const id of EMAIL_TEMPLATE_IDS) {
        const def = getTemplate(id);
        const v = sampleVars(id);
        const { html, text } = renderEmail(def.build(v, {}), { baseUrl: "https://haven.example" });
        const doc = def.build(v, {});
        if (!html.includes("<html") || !text.includes(doc.heading) || text.length < 40) bad.push(id);
      }
      if (bad.length) throw new Error(`did not render: ${bad.join(", ")}`);
      return true;
    });

    await t.check("every subject follows the rule and its template's pattern", () => {
      const bad = EMAIL_TEMPLATE_IDS.filter((id) => {
        const def = getTemplate(id);
        const s = def.subject(sampleVars(id));
        return !SUBJECT_RE.test(s) || !def.subjectPattern.test(s);
      });
      if (bad.length) throw new Error(bad.join(", "));
      return true;
    });

    await t.check("private emails never name a category of need", () => {
      const bad: string[] = [];
      for (const id of SENSITIVE_EMAIL_TEMPLATES) {
        const p = previewEmail(id, {});
        const word = categoryWordIn(`${p.subject}\n${p.text}`);
        if (word) bad.push(`${id} (“${word}”)`);
      }
      if (bad.length) throw new Error(bad.join(", "));
      return true;
    });

    await t.check("private emails carry the emergency notice (public ones)", () => {
      const p = previewEmail("support_confirmation", {});
      return /immediate danger/i.test(p.text);
    });

    await t.check("editable wording allows only {firstName} and {ref}", () => {
      const ok = Object.keys(copyProblems("donation_acknowledgement", { main: "Dear {firstName}, thank you ({ref})." })).length === 0;
      const bad = copyProblems("donation_acknowledgement", { main: "Hello {name}" }).main;
      return ok && Boolean(bad) ? true : `ok=${ok} bad=${bad}`;
    });

    await t.check("private wording can't mention why someone wrote", () => {
      const p = copyProblems("support_confirmation", { main: "We have your request about school fees and medical care." }).main;
      const long = copyProblems("support_confirmation", { main: "x".repeat(401) }).main;
      return Boolean(p) && Boolean(long) ? true : `category=${p} long=${long}`;
    });

    await t.check("only updates carry an unsubscribe link", () => {
      const updates = EMAIL_TEMPLATE_IDS.filter((id) => getTemplate(id).updates);
      const p = previewEmail("supporter_update", {});
      return updates.length === 1 && updates[0] === "supporter_update" && /unsubscribe/i.test(p.html) && !/unsubscribe/i.test(previewEmail("donation_acknowledgement", {}).html) ? true : `updates=${updates.join(",")}`;
    });

    await t.check("Reply-To follows the team mailboxes", () => {
      const contact = { email: "hello@haven.example", teamEmails: { donations: "donations@haven.example", support: "support@haven.example", safeguarding: "safe@haven.example", privacy: "privacy@haven.example" } };
      const ok =
        replyToFor("donations", contact) === "donations@haven.example" &&
        replyToFor("safeguarding", contact) === "safe@haven.example" &&
        replyToFor("default", contact) === "hello@haven.example" &&
        replyToFor("none", contact) === null;
      return ok;
    });

    await t.check("without a Resend key every email is held, never sent", () => {
      if (env.email.resendKey) return `skipped: a key is set (mode ${emailMode()})`;
      return emailMode() === "mailbox";
    });

    return t.cases;
  },
};
