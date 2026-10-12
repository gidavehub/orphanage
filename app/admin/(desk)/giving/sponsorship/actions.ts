"use server";

// Giving › Sponsorship Server Actions (PLAN D55). The DAL checks sponsor.manage / sponsor.publish,
// the version and the safety check; every write expires the public sponsorship tags so
// /get-involved/sponsor shows the change on the next request.

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { ActionResult } from "@/lib/forms/types";
import { addSponsorUpdate, publishSponsorProfile, saveSponsorProfile, setSponsorStatus, type SponsorInput } from "@/lib/server/dal/sponsors";

function settle<T>(r: ActionResult<T>, code: string | undefined): ActionResult<T> {
  if (r.ok) {
    updateTag(TAG.col("sponsorProfiles"));
    if (code) updateTag(TAG.item("sponsorProfiles", code));
    refresh();
  }
  return r;
}

export async function saveSponsorAction(input: SponsorInput) {
  const r = await saveSponsorProfile(input);
  return settle(r, r.ok ? r.data.code : input.code);
}

export async function publishSponsorAction(code: string, expectedVersion: number, reviewed: boolean) {
  return settle(await publishSponsorProfile(code, expectedVersion, reviewed), code);
}

export async function setSponsorStatusAction(code: string, expectedVersion: number, to: "draft" | "archived") {
  return settle(await setSponsorStatus(code, expectedVersion, to), code);
}

export async function addSponsorUpdateAction(code: string, text: string) {
  return settle(await addSponsorUpdate(code, text), code);
}
