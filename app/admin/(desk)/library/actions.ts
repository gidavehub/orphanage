"use server";

// Reports & resources Server Actions (admin-ux §6.8). Library saves expire the public library tags so
// /resources shows the change on the next request; request moves drain the outbox after the response.

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { moveReportRequest, revealRequesterEmail } from "@/lib/server/dal/reportRequests";
import { saveResource, type SaveResourceInput } from "@/lib/server/dal/resources";
import type { ReportRequestInput } from "@/lib/server/workflow/reportRequest";

export async function saveResourceAction(input: SaveResourceInput): Promise<ActionResult<{ id: string; version: number }>> {
  const r = await saveResource(input);
  if (r.ok) {
    updateTag(TAG.col("resources"));
    updateTag(TAG.item("resources", input.slug));
    refresh();
  }
  return r;
}

export async function moveReportRequestAction(ref: string, edgeId: string, version: number, input: ReportRequestInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return { ok: false, error: { kind: "not_allowed", message: "That step isn't available." } };
  const r = await moveReportRequest(ref, edgeId, version, input);
  if (r.ok) refresh();
  return r;
}

export async function revealRequesterEmailAction(ref: string): Promise<string | null> {
  return revealRequesterEmail(ref);
}
