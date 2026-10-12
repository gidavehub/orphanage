import "server-only";

// People › Directory (admin-ux §6.9): the referral partners programme officers refer people to, each
// with a service type, contact details and "Approved by Haven" (§5 asks for approved professionals).
// The support request's referral sheet lists the active ones (`referralOptions`).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { ReferralPartner } from "@/lib/model/domain/engagement";
import { PROGRAMME_IDS, REFERRAL_TYPES, type Millis, type ProgrammeId, type ReferralType } from "@/lib/model/enums";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import type { WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

export type ReferralPartnerDTO = {
  id: string;
  version: number;
  name: string;
  type: ReferralType;
  services: string;
  country: string;
  locality: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  programmeIds: ProgrammeId[];
  active: boolean;
  approvedAt: Millis | null;
};

type Stored = ReferralPartner & { approvedAt?: Millis | null };

async function listAll(): Promise<Array<WithId<Stored>>> {
  const out: Array<WithId<Stored>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page: { items: Array<WithId<Stored>>; nextCursor: string | null } = await getStore().list<Stored>(C.referralPartners, { orderBy: { field: "name", dir: "asc" }, limit: 100, cursor });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

const toDTO = (r: WithId<Stored>): ReferralPartnerDTO => ({
  id: r.id,
  version: r.version ?? 0,
  name: r.name,
  type: r.type,
  services: r.services,
  country: r.country,
  locality: r.locality,
  contactName: r.contactName,
  email: r.email,
  phone: r.phone,
  website: r.website,
  notes: r.notes,
  programmeIds: r.programmeIds ?? [],
  active: r.active,
  approvedAt: r.approvedAt ?? null,
});

export async function listReferralPartners(): Promise<{ rows: ReferralPartnerDTO[]; canEdit: boolean }> {
  const v = await requireStaff("referralPartner.manage", "support.read", "support.manage");
  try {
    return { rows: (await listAll()).map(toDTO), canEdit: has(v, "referralPartner.manage") };
  } catch (err) {
    log.warn("dal.referralPartners.list_failed", { err });
    return { rows: [], canEdit: has(v, "referralPartner.manage") };
  }
}

/** Active directory entries for the referral sheet on a support request. */
export async function referralOptions(): Promise<Array<{ id: string; name: string; type: ReferralType; approved: boolean }>> {
  await requireStaff("support.manage", "support.read");
  try {
    return (await listAll()).filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, type: r.type, approved: Boolean(r.approvedAt) }));
  } catch {
    return [];
  }
}

export type ReferralPartnerInput = Omit<ReferralPartnerDTO, "id" | "version" | "approvedAt"> & { id: string | null; expectedVersion: number; approved: boolean };

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").trim();
  return t ? t.slice(0, n) : null;
};

export async function saveReferralPartner(input: ReferralPartnerInput): Promise<ActionResult<{ id: string; version: number }>> {
  const v = await requireStaff("referralPartner.manage");
  const f: Record<string, string> = {};
  if (input.name.trim().length < 2) f.name = "Give the organisation's name.";
  if (!(REFERRAL_TYPES as readonly string[]).includes(input.type)) f.type = "Choose what kind of service it is.";
  if (input.services.trim().length < 5) f.services = "Say in a line what they offer.";
  if (input.services.length > 300) f.services = "Please keep this to 300 characters.";
  if (!/^[a-z]{2}$/.test(input.country)) f.country = "Choose a country.";
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) f.email = "That email doesn't look right.";
  if (input.website && !/^https?:\/\/\S+$/.test(input.website.trim())) f.website = "Use a full web address starting with https://";
  if ((input.notes ?? "").length > 1000) f.notes = "Please keep notes to 1,000 characters.";
  if (Object.keys(f).length) return actionError({ kind: "validation", fields: f });
  const id = input.id ?? newId();
  const path = docPath("referralPartners", id);
  try {
    const out = await getStore().runTransaction(async (tx) => {
      const cur = await tx.get<Stored & { version?: number }>(path);
      if (input.id && !cur) return { error: "This entry no longer exists." };
      if (cur && (cur.version ?? 0) !== input.expectedVersion) return { error: "Someone else changed this entry. Reload to see their changes." };
      const now = Date.now();
      const version = (cur?.version ?? 0) + 1;
      const doc: Stored & { version: number } = {
        name: input.name.trim().slice(0, 120),
        type: input.type,
        services: input.services.trim(),
        country: input.country,
        locality: clip(input.locality, 80),
        contactName: clip(input.contactName, 80),
        email: clip(input.email, 160),
        phone: clip(input.phone, 30),
        website: clip(input.website, 300),
        notes: clip(input.notes, 1000),
        programmeIds: input.programmeIds.filter((p) => (PROGRAMME_IDS as readonly string[]).includes(p)),
        active: input.active,
        approvedAt: input.approved ? (cur?.approvedAt ?? now) : null,
        createdBy: cur?.createdBy ?? v.uid,
        searchTokens: buildSearchTokens({ reference: id, extra: input.name.toLowerCase().split(/\s+/).slice(0, 8) }),
        createdAt: cur?.createdAt ?? now,
        updatedAt: now,
        version,
      };
      tx.set(path, doc);
      auditTx(tx, { actor: actorOf(v), action: cur ? "referralPartner.update" : "referralPartner.create", area: "engagement", summary: `${v.displayName} ${cur ? "updated" : "added"} ${doc.name} in the directory`, feed: true, targetPath: path });
      return { version };
    });
    if ("error" in out) return actionError({ kind: "not_allowed", message: out.error! });
    return actionOk({ id, version: out.version! });
  } catch (err) {
    log.error("dal.referralPartners.save_failed", { err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}
