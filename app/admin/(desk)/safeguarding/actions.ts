"use server";

// Safeguarding Server Actions (admin-ux §6.5). The DAL checks concern.manage and the 30-minute
// step-up on every call; refresh() re-renders the restricted list and the open concern.

import { drainAfterResponse } from "@/lib/server/email/outbox";
import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { addConcernAction, moveConcern, requestConcernClosure } from "@/lib/server/dal/concerns";
import type { ConcernActionInput } from "@/lib/server/workflow/concern";

export async function concernMove(ref: string, edgeId: string, expectedVersion: number, input: Record<string, unknown> = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return { ok: false, error: { kind: "not_allowed", message: "That step isn't available." } };
  const r = await moveConcern(ref, edgeId, expectedVersion, input);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function concernAction(ref: string, a: ConcernActionInput): Promise<ActionResult> {
  const r = await addConcernAction(ref, a);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function concernRequestClose(ref: string, reason: string, note: string): Promise<ActionResult> {
  const r = await requestConcernClosure(ref, reason, note);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}
