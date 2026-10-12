"use server";

// People Server Actions (admin-ux §6.9). The DAL checks volunteer.manage / partnership.manage /
// referralPartner.manage and the record; moves go through FLOWS.

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis, Uid } from "@/lib/model/enums";
import { movePartner, setPartnerFollowUp } from "@/lib/server/dal/partnerships";
import { saveReferralPartner, type ReferralPartnerInput } from "@/lib/server/dal/referralPartners";
import { moveVolunteer, setSafeguardingCheck, setVolunteerFollowUp, toggleChecklist } from "@/lib/server/dal/volunteers";
import type { PeopleInput } from "@/lib/server/workflow/volunteer";

const EDGE = /^[a-z_]{2,40}$/;
const refused = { ok: false as const, error: { kind: "not_allowed" as const, message: "That step isn't available." } };

function settle<T>(r: ActionResult<T>): ActionResult<T> {
  if (r.ok) refresh();
  return r;
}

export async function moveVolunteerAction(ref: string, edgeId: string, version: number, input: PeopleInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!EDGE.test(edgeId)) return refused;
  return settle(await moveVolunteer(ref, edgeId, version, input));
}

export async function movePartnerAction(ref: string, edgeId: string, version: number, input: PeopleInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!EDGE.test(edgeId)) return refused;
  return settle(await movePartner(ref, edgeId, version, input));
}

export async function toggleChecklistAction(ref: string, version: number, stepId: string, done: boolean) {
  return settle(await toggleChecklist(ref, version, stepId, done));
}

export async function volunteerFollowUpAction(ref: string, version: number, uid: Uid | null, at: Millis | null) {
  return settle(await setVolunteerFollowUp(ref, version, uid, at));
}

export async function partnerFollowUpAction(ref: string, version: number, uid: Uid | null, at: Millis | null) {
  return settle(await setPartnerFollowUp(ref, version, uid, at));
}

export async function safeguardingCheckAction(ref: string, version: number, status: "not_required" | "pending" | "cleared" | "not_cleared") {
  return settle(await setSafeguardingCheck(ref, version, status));
}

export async function saveReferralPartnerAction(input: ReferralPartnerInput) {
  return settle(await saveReferralPartner(input));
}
