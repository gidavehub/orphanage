import "server-only";

// Staff-editable email wording (integrations §4.5; admin-ux "Emails Haven sends"). settings/emailCopy
// holds, per template, an optional greeting, main paragraph and sign-off. Only {firstName} and {ref}
// may be used. Subjects never change here. Sensitive templates keep their main paragraph short (400)
// and must pass the safety lint (no names, places or health words) and name no category of need.

import type { EmailCopySettings } from "@/lib/model/domain/settings";
import { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES, type EmailTemplateId } from "@/lib/model/email";
import type { Millis } from "@/lib/model/enums";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { Viewer } from "@/lib/model/viewer";
import { safetyFlags } from "@/lib/content/safety";
import { actorOf, auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { settingsPath } from "@/lib/server/db/collections";
import { renderEmail } from "./render";
import { getTemplate, subjectRefKey } from "./templates";
import type { EditableCopy, EmailVars } from "./types";

export type CopyField = keyof EditableCopy;
export const COPY_LIMITS: Record<CopyField, number> = { greeting: 120, main: 1200, signOff: 120 };
export const SENSITIVE_MAIN_LIMIT = 400;

/** Words that would reveal why someone contacted Haven (never in sensitive emails). */
const CATEGORY_WORDS = /\b(abuse|abused|neglect|violence|assault|sexual|medical|medicine|hospital|illness|disease|hiv|pregnan\w*|legal|lawyer|court|custody|counsell?ing|therapy|trauma|mental|depress\w*|suicid\w*|food|hunger|school fees|disabilit\w*)\b/i;

const PLACEHOLDER = /\{([^}]*)\}/g;

/** The first word that would reveal why someone contacted Haven, or null. */
export function categoryWordIn(text: string): string | null {
  return CATEGORY_WORDS.exec(text)?.[0] ?? null;
}

export function isSensitive(id: EmailTemplateId): boolean {
  return (SENSITIVE_EMAIL_TEMPLATES as readonly string[]).includes(id);
}

/** Field problems for one template's wording, or {} when it can be saved. */
export function copyProblems(id: EmailTemplateId, copy: EditableCopy): Partial<Record<CopyField, string>> {
  const out: Partial<Record<CopyField, string>> = {};
  for (const field of ["greeting", "main", "signOff"] as const) {
    const text = copy[field];
    if (text === undefined || text === "") continue;
    const max = field === "main" && isSensitive(id) ? SENSITIVE_MAIN_LIMIT : COPY_LIMITS[field];
    if (text.length > max) {
      out[field] = `Please keep this to ${max} characters.`;
      continue;
    }
    const bad = [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((p) => p !== "firstName" && p !== "ref");
    if (bad.length) {
      out[field] = `Only {firstName} and {ref} can be filled in. Remove {${bad[0]}}.`;
      continue;
    }
    if (/[<>]/.test(text)) {
      out[field] = "Please use plain words (no < or >).";
      continue;
    }
    if (isSensitive(id)) {
      if (CATEGORY_WORDS.test(text)) {
        out[field] = "This email must not say what the person asked about. Keep it general.";
        continue;
      }
      const flags = safetyFlags(text.replace(PLACEHOLDER, ""));
      if (flags.length) out[field] = `Please remove “${flags[0].text}”: this email must not name people, places or health matters.`;
    }
  }
  return out;
}

const SAMPLE_REF: Record<string, string> = { SR: "HVN-SR-2026-0042", DN: "HVN-DN-2026-0042", RC: "HVN-RC-2026-0042", RG: "HVN-RG-2026-0007", AP: "HVN-AP-2026-0012", RR: "HVN-RR-2026-0009", VA: "HVN-VA-2026-0015", PE: "HVN-PE-2026-0004", CM: "HVN-CM-2026-0031", SS: "HVN-SS-2026-0003", DR: "HVN-DR-2026-0002" };

/** Realistic sample values for previews and the selftest (never real data). */
export function sampleVars(id: EmailTemplateId, origin = "https://haven.example"): EmailVars {
  const subject = getTemplate(id).subjectPattern.source;
  const prefix = /HVN-([A-Z]{2})-/.exec(subject)?.[1] ?? "SR";
  const ref = SAMPLE_REF[prefix] ?? SAMPLE_REF.SR;
  const vars: EmailVars = {
    firstName: "Amina",
    reference: subjectRefKey(id) === "receiptNumber" ? SAMPLE_REF.DN : ref,
    link: `${origin}/example-link`,
    amount: "USD 50.00",
    date: "11 October 2026",
    count: 2,
    priority: "High",
  };
  if (subjectRefKey(id) === "receiptNumber") vars.receiptNumber = SAMPLE_REF.RC;
  if (id === "counselling_confirmation" || id === "counselling_cancelled") {
    vars.startsAt = Date.UTC(2026, 9, 20, 14, 0);
    vars.durationMin = 45;
    vars.when = "Tuesday 20 October 2026 at 14:00 (Banjul time)";
  }
  if (id === "supporter_update") {
    vars.title = "Back to school with 50 children";
    vars.excerpt = "This month, fifty children went back to school with fees, uniforms and books.";
    vars.unsubscribeUrl = `${origin}/unsubscribe?t=example`;
  }
  return vars;
}

export async function getEmailCopy(): Promise<{ copy: EmailCopySettings; updatedAt: Millis | null }> {
  const doc = await getStore().get<EmailCopySettings & { updatedAt?: Millis }>(settingsPath("emailCopy")).catch(() => null);
  const copy: EmailCopySettings = {};
  for (const id of EMAIL_TEMPLATE_IDS) if (doc?.[id]) copy[id] = doc[id];
  return { copy, updatedAt: doc?.updatedAt ?? null };
}

/** The subject and HTML a template renders with the given wording and sample values. */
export function previewEmail(id: EmailTemplateId, copy: EditableCopy, origin?: string): { subject: string; html: string; text: string } {
  const def = getTemplate(id);
  const vars = sampleVars(id, origin);
  const { html, text } = renderEmail(def.build(vars, copy), { baseUrl: origin, unsubscribeUrl: typeof vars.unsubscribeUrl === "string" ? vars.unsubscribeUrl : null });
  return { subject: def.subject(vars), html, text };
}

/** Saves one template's wording (empty fields go back to Haven's standard words). */
export async function saveEmailCopy(v: Viewer, id: EmailTemplateId, copy: EditableCopy, baseUpdatedAt: Millis | null): Promise<ActionResult<{ updatedAt: Millis }>> {
  const clean: EditableCopy = {};
  for (const f of ["greeting", "main", "signOff"] as const) {
    const t = typeof copy[f] === "string" ? copy[f]!.replace(/\r\n/g, "\n").trim() : "";
    if (t) clean[f] = t;
  }
  const problems = copyProblems(id, clean);
  if (Object.keys(problems).length) return actionError({ kind: "validation", fields: problems as Record<string, string> });
  const now = Date.now();
  const out = await getStore().runTransaction(async (tx) => {
    const cur = await tx.get<EmailCopySettings & { updatedAt?: Millis }>(settingsPath("emailCopy"));
    if ((cur?.updatedAt ?? null) !== baseUpdatedAt) return "conflict" as const;
    const next: Record<string, unknown> = { ...(cur ?? {}), updatedAt: now, updatedBy: v.uid };
    delete next.id;
    if (Object.keys(clean).length) next[id] = clean;
    else delete next[id];
    tx.set(settingsPath("emailCopy"), next);
    auditTx(tx, { actor: actorOf(v), action: "settings.change", area: "settings", summary: `${v.displayName} changed the wording of an email Haven sends`, feed: true, targetPath: settingsPath("emailCopy") });
    return "ok" as const;
  });
  if (out === "conflict") return actionError({ kind: "not_allowed", message: "Someone else changed the email wording just now. Reload to see their changes." });
  return actionOk({ updatedAt: now });
}
