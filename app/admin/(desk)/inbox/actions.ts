"use server";

// Server Actions shared by the Inbox, Requests and record views (admin-ux §6.3–6.4). Each one calls
// the DAL (which checks the person and the record) and then refresh() so the list in the layout and
// the open record re-render in the same round trip.

import { drainAfterResponse } from "@/lib/server/email/outbox";
import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/forms/types";
import { actionError } from "@/lib/forms/types";
import type { Millis, SupportCategory } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";
import { addCaseNote, markSeen, snoozeRecord, takeRecord } from "@/lib/server/dal/caseActions";
import { messageToSupport, revealMessageContact, storyToTestimonial } from "@/lib/server/dal/engagement";
import { revealSupportContact, updateSupportTriage } from "@/lib/server/dal/support";
import { contactMachine, storyMachine } from "@/lib/server/workflow/engagement";
import { supportMachine, type SupportInput } from "@/lib/server/workflow/support";
import { transitionResult } from "@/lib/server/workflow/flow";

export async function take(ref: string): Promise<ActionResult> {
  const r = await takeRecord(ref);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function snooze(ref: string, until: Millis | null): Promise<ActionResult> {
  const r = await snoozeRecord(ref, until);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function seen(ref: string): Promise<void> {
  await markSeen(ref);
}

export async function addNote(ref: string, kind: "note" | "call", text: string): Promise<ActionResult> {
  const r = await addCaseNote(ref, kind, text);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

/** One step on a support request (the stepper's buttons and sheets). */
export async function moveSupport(ref: string, edgeId: string, expectedVersion: number, input: SupportInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("support.manage");
  if (typeof edgeId !== "string" || !/^[a-z_]{2,40}$/.test(edgeId)) return actionError({ kind: "not_allowed", message: "That step isn't available." });
  const r = await transitionResult(() => supportMachine.transition({ ref, edgeId, actor: v, expectedVersion, input }));
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function revealContact(ref: string, field: "phone" | "email"): Promise<string | null> {
  return revealSupportContact(ref, field === "email" ? "email" : "phone");
}

export async function saveTriage(
  ref: string,
  input: { eligibility: "eligible" | "ineligible" | "unclear" | null; verification: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; expectedVersion: number },
): Promise<ActionResult> {
  const r = await updateSupportTriage(ref, input);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

/* ── Messages and story submissions ───────────────────────────────────── */

export async function moveMessage(ref: string, edgeId: string, expectedVersion: number, input: { message?: string } = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("contact.manage");
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return actionError({ kind: "not_allowed", message: "That step isn't available." });
  const r = await transitionResult(() => contactMachine.transition({ ref, edgeId, actor: v, expectedVersion, input }));
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function moveStory(ref: string, edgeId: string, expectedVersion: number, input: { reason?: string } = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("storySubmission.manage");
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return actionError({ kind: "not_allowed", message: "That step isn't available." });
  const r = await transitionResult(() => storyMachine.transition({ ref, edgeId, actor: v, expectedVersion, input }));
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function revealMessage(ref: string, field: "phone" | "email"): Promise<string | null> {
  return revealMessageContact(ref, field === "email" ? "email" : "phone");
}

export async function turnIntoRequest(ref: string, category: SupportCategory): Promise<ActionResult<{ ref: string }>> {
  const r = await messageToSupport(ref, category);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function turnIntoTestimonial(ref: string, quote: string): Promise<ActionResult<{ id: string }>> {
  const r = await storyToTestimonial(ref, quote);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}
