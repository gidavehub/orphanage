"use server";

// Settings › Emails (admin-ux "Emails Haven sends"; integrations §4.5): preview and save the editable
// wording of one template. Super admins (settings.manage).

import { refresh } from "next/cache";
import { actionError, type ActionResult } from "@/lib/forms/types";
import { isEmailTemplateId } from "@/lib/model/email";
import type { Millis } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";
import { copyProblems, previewEmail, saveEmailCopy } from "@/lib/server/email/copy";
import type { EditableCopy } from "@/lib/server/email/types";
import { baseUrl } from "@/lib/server/url";

function clean(copy: EditableCopy): EditableCopy {
  const out: EditableCopy = {};
  for (const f of ["greeting", "main", "signOff"] as const) if (typeof copy?.[f] === "string") out[f] = copy[f]!.slice(0, 2000);
  return out;
}

export async function previewEmailAction(id: string, copy: EditableCopy): Promise<{ subject: string; html: string; problems: Record<string, string> } | null> {
  await requireStaff("settings.manage");
  if (!isEmailTemplateId(id)) return null;
  const c = clean(copy);
  const problems = copyProblems(id, c) as Record<string, string>;
  const p = previewEmail(id, Object.fromEntries(Object.entries(c).filter(([k]) => !problems[k])), baseUrl());
  return { subject: p.subject, html: p.html, problems };
}

export async function saveEmailCopyAction(id: string, copy: EditableCopy, baseUpdatedAt: Millis | null): Promise<ActionResult<{ updatedAt: Millis }>> {
  const v = await requireStaff("settings.manage");
  if (!isEmailTemplateId(id)) return actionError({ kind: "not_allowed", message: "That email doesn't exist." });
  const r = await saveEmailCopy(v, id, clean(copy), typeof baseUpdatedAt === "number" ? baseUpdatedAt : null);
  if (r.ok) refresh();
  return r;
}
