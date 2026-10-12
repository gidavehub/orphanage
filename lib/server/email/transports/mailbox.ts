import "server-only";

// Mailbox transport (integrations §4.2, PLAN D106): nothing is ever sent. The rendered email is kept
// on the outbox record (`preview`, status `held`) and, in local practice mode, also written to
// .data/mailbox/{outboxId}.html so developers can open it. Held items are test data: adding a
// provider key later never sends them.

import { DOCUMENT_ID_RE } from "@/lib/model/enums";
import { dataPath, readFileOrNull, removePath, writeFileAtomic } from "@/lib/server/db/local-fs";
import { resolveBackend } from "@/lib/server/env";
import { escapeHtml } from "@/lib/server/security/sanitise";
import type { OutgoingEmail, TransportResult } from "../provider";

/** .data/mailbox/{id}.html (local mode only). */
export function mailboxFilePath(id: string): string {
  if (!DOCUMENT_ID_RE.test(id)) throw new Error("Invalid outbox id.");
  return dataPath("mailbox", `${id}.html`);
}

function localMode(): boolean {
  try {
    return resolveBackend() === "local";
  } catch {
    return false;
  }
}

/** Holds a message: writes the local preview file when in practice mode. */
export async function deliverToMailbox(msg: OutgoingEmail): Promise<TransportResult> {
  if (localMode()) {
    const header = `<!--\n  Haven Outbox (practice mode): this email was NOT sent.\n  Template: ${msg.template}\n  Subject: ${msg.subject.replace(/--/g, "")}\n-->\n`;
    const banner = `<div style="font:14px/20px system-ui,sans-serif;background:#f3e7d3;color:#4a2c1a;padding:10px 16px">Held in the Outbox · ${escapeHtml(msg.template)} · not sent</div>`;
    const html = msg.html.replace(/<body([^>]*)>/i, (m) => `${m}${banner}`);
    await writeFileAtomic(mailboxFilePath(msg.id), header + html);
    // Attachments sit beside the preview: {outboxId}~{filename} (e.g. the session's .ics).
    for (const a of msg.attachments) {
      const name = a.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
      await writeFileAtomic(dataPath("mailbox", `${msg.id}~${name}`), a.content);
    }
  }
  return { kind: "held", provider: "mailbox" };
}

/** The local preview file's HTML, or null. */
export async function readMailboxFile(id: string): Promise<string | null> {
  if (!localMode()) return null;
  const buf = await readFileOrNull(mailboxFilePath(id));
  return buf ? buf.toString("utf8") : null;
}

export async function removeMailboxFile(id: string): Promise<void> {
  if (!localMode()) return;
  await removePath(mailboxFilePath(id));
}
