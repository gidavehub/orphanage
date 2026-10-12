"use server";

// Counselling Server Actions (admin-ux §6.7). The DAL checks appointment.manage / appointment.own and
// the record; actions that queue email drain the outbox after the response.

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import {
  addSessionNote,
  createZoomForSession,
  hostStartLink,
  bookingOptions,
  bookSession,
  moveSession,
  noteTargets,
  reassignSession,
  sendInvitation,
  setZoomLink,
  type BookSessionInput,
} from "@/lib/server/dal/appointments";
import type { AppointmentInput } from "@/lib/server/workflow/appointment";

function settle<T>(r: ActionResult<T>): ActionResult<T> {
  if (r.ok) refresh();
  return r;
}

export async function bookSessionAction(input: BookSessionInput) {
  return settle(await bookSession(input));
}

export async function bookingOptionsAction() {
  return bookingOptions();
}

export async function setZoomLinkAction(ref: string, version: number, url: string) {
  return settle(await setZoomLink(ref, version, url));
}

export async function reassignSessionAction(ref: string, version: number, counsellorUid: string) {
  return settle(await reassignSession(ref, version, counsellorUid));
}

export async function sendInvitationAction(ref: string, version: number) {
  return settle(await sendInvitation(ref, version));
}

export async function moveSessionAction(ref: string, edgeId: string, version: number, input: AppointmentInput & { date?: string; time?: string } = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return { ok: false, error: { kind: "not_allowed", message: "That step isn't available." } };
  return settle(await moveSession(ref, edgeId, version, input));
}

export async function addSessionNoteAction(ref: string, text: string) {
  return settle(await addSessionNote(ref, text));
}

export async function noteTargetsAction() {
  return noteTargets();
}

export async function createZoomAction(ref: string, version: number) {
  return settle(await createZoomForSession(ref, version));
}

/** "Start as host": a fresh Zoom start link for the session's counsellor, opened straight away. */
export async function startAsHostAction(ref: string): Promise<{ url: string | null }> {
  return { url: await hostStartLink(ref) };
}
