import "server-only";

// Giving › Sponsorship (PLAN D55, D82; data-model §4.6). Programme officers draft anonymous profiles
// and post programme-level updates; content managers (and super admins) put them live after the
// safety check passes and they tick "No names, precise locations or medical history". A live profile
// can only be changed to words that still pass the check. `linkedSupportRef` stays with programme
// officers and super admins and never reaches the public DTO (lib/server/public/sponsors.ts).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { SponsorProfile, SponsorUpdate } from "@/lib/model/domain/sponsor";
import { AGE_BANDS, CURRENCIES, SUPPORT_CATEGORIES, SUPPORT_CATEGORY_PROGRAMME, type AgeBand, type Currency, type Millis, type SupportCategory } from "@/lib/model/enums";
import { SPONSOR_RE } from "@/lib/model/refs";
import { safetyFlags, type SafetyFlag } from "@/lib/content/safety";
import type { SponsorProfileStatus } from "@/lib/model/status";
import { fromMinor, toMinor } from "@/lib/money";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath, subDocPath, subPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import { log } from "@/lib/server/log";
import { nextSponsorCode } from "@/lib/server/references";
import { staffRefs } from "./_shared";

type Stored = SponsorProfile & { id: string };
export type SponsorPeriod = SponsorProfile["need"]["period"];
const PERIODS: readonly SponsorPeriod[] = ["one_off", "per_term", "per_month", "per_year"];

export type SponsorRowDTO = {
  code: string;
  status: SponsorProfileStatus;
  ageBand: AgeBand;
  category: SupportCategory;
  description: string;
  amount: number;
  currency: Currency;
  period: SponsorPeriod;
  sponsorsNeeded: number;
  sponsorsCurrent: number;
  flags: number;
  updatedAt: Millis;
};

export type SponsorEditorDTO = {
  /** null when adding a new profile. */
  code: string | null;
  version: number;
  status: SponsorProfileStatus;
  ageBand: AgeBand;
  category: SupportCategory;
  country: string | null;
  description: string;
  amount: number;
  currency: Currency;
  period: SponsorPeriod;
  sponsorsNeeded: number;
  sponsorsCurrent: number;
  /** Shown to programme officers and super admins only. */
  linkedSupportRef: string | null;
  review: { by: string; at: Millis } | null;
  updates: Array<{ id: string; at: Millis; text: string; by: string }>;
  can: { edit: boolean; publish: boolean; seeLink: boolean };
};

const READ = ["sponsor.manage", "sponsor.publish"] as const;

function toRow(p: Stored): SponsorRowDTO {
  return {
    code: p.code ?? p.id,
    status: p.status,
    ageBand: p.ageBand,
    category: p.supportCategory,
    description: p.need?.description ?? "",
    amount: p.need ? fromMinor(p.need.amount.amountMinor, p.need.amount.currency) : 0,
    currency: p.need?.amount.currency ?? "USD",
    period: p.need?.period ?? "one_off",
    sponsorsNeeded: p.sponsorsNeeded ?? 0,
    sponsorsCurrent: p.sponsorsCurrent ?? 0,
    flags: safetyFlags(p.need?.description ?? "").length,
    updatedAt: p.updatedAt ?? p.createdAt ?? 0,
  };
}

/** Every profile, newest first (archived last). */
export async function listSponsorProfilesForStaff(): Promise<SponsorRowDTO[]> {
  await requireStaff(...READ);
  const out: Stored[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page: { items: Stored[]; nextCursor: string | null } = await getStore().list<SponsorProfile>(C.sponsorProfiles, { orderBy: { field: "createdAt", dir: "desc" }, limit: 100, cursor });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out.map(toRow).sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived"));
}

export async function getSponsorForEditor(code: string): Promise<SponsorEditorDTO | null> {
  const v = await requireStaff(...READ);
  const can = { edit: has(v, "sponsor.manage") || has(v, "sponsor.publish"), publish: has(v, "sponsor.publish"), seeLink: has(v, "sponsor.manage") };
  if (code === "new") {
    if (!has(v, "sponsor.manage")) return null;
    return {
      code: null,
      version: 0,
      status: "draft",
      ageBand: "10-14",
      category: "education",
      country: "gm",
      description: "",
      amount: 0,
      currency: "USD",
      period: "per_term",
      sponsorsNeeded: 1,
      sponsorsCurrent: 0,
      linkedSupportRef: null,
      review: null,
      updates: [],
      can,
    };
  }
  if (!SPONSOR_RE.test(code)) return null;
  const [p, updates, staff] = await Promise.all([
    getStore().get<SponsorProfile & { version?: number }>(docPath("sponsorProfiles", code)),
    getStore()
      .list<SponsorUpdate>(subPath("sponsorProfiles", code, "updates"), { orderBy: { field: "at", dir: "desc" }, limit: 50 })
      .catch((err) => {
        log.warn("dal.sponsors.updates_failed", { code, err });
        return { items: [] as Array<SponsorUpdate & { id: string }>, nextCursor: null };
      }),
    staffRefs(),
  ]);
  if (!p) return null;
  const name = (uid: string) => staff.get(uid)?.name ?? "a former team member";
  return {
    code,
    version: p.version ?? 0,
    status: p.status,
    ageBand: p.ageBand,
    category: p.supportCategory,
    country: p.country,
    description: p.need.description,
    amount: fromMinor(p.need.amount.amountMinor, p.need.amount.currency),
    currency: p.need.amount.currency,
    period: p.need.period,
    sponsorsNeeded: p.sponsorsNeeded,
    sponsorsCurrent: p.sponsorsCurrent,
    linkedSupportRef: can.seeLink ? p.linkedSupportRef : null,
    review: p.review ? { by: name(p.review.by), at: p.review.at } : null,
    updates: updates.items.filter((u) => u.published).map((u) => ({ id: u.id, at: u.at, text: u.text, by: name(u.by) })),
    can,
  };
}

export type SponsorInput = {
  code?: string;
  expectedVersion?: number;
  ageBand: AgeBand;
  category: SupportCategory;
  country: string | null;
  description: string;
  amount: number;
  currency: Currency;
  period: SponsorPeriod;
  sponsorsNeeded: number;
  sponsorsCurrent: number;
  linkedSupportRef?: string | null;
};

function validate(input: SponsorInput): Record<string, string> {
  const f: Record<string, string> = {};
  if (!(AGE_BANDS as readonly string[]).includes(input.ageBand)) f.ageBand = "Please choose an age band.";
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(input.category)) f.category = "Please choose what the support is for.";
  if (input.country !== null && !/^[a-z]{2}$/.test(input.country)) f.country = "Please choose a country.";
  const d = input.description.trim();
  if (d.length < 20) f.description = "Please describe the need in a sentence or two.";
  else if (d.length > 300) f.description = "Please keep the need to 300 characters or fewer.";
  if (!(CURRENCIES as readonly string[]).includes(input.currency)) f.currency = "Please choose a currency.";
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1_000_000) f.amount = "Please give the amount needed.";
  if (!PERIODS.includes(input.period)) f.period = "Please choose how often.";
  if (!Number.isInteger(input.sponsorsNeeded) || input.sponsorsNeeded < 1 || input.sponsorsNeeded > 50) f.sponsorsNeeded = "Between 1 and 50 sponsors.";
  if (!Number.isInteger(input.sponsorsCurrent) || input.sponsorsCurrent < 0 || input.sponsorsCurrent > input.sponsorsNeeded) f.sponsorsCurrent = "Can’t be more than the sponsors needed.";
  if (input.linkedSupportRef && !/^HVN-SR-\d{4}-\d{4,}$/.test(input.linkedSupportRef)) f.linkedSupportRef = "Use a request reference like HVN-SR-2026-0012.";
  return f;
}

const reasonsOf = (flags: SafetyFlag[]) => flags.map((x) => x.message);

class Refusal extends Error {
  constructor(readonly result: ActionResult<never>) {
    super("refused");
  }
}
const refuse = (r: ActionResult<never>): never => {
  throw new Refusal(r);
};

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return actionOk(await fn());
  } catch (err) {
    if (err instanceof Refusal) return err.result as ActionResult<T>;
    throw err;
  }
}

const stale = (p: { version?: number; updatedAt?: number }) =>
  actionError<never>({ kind: "conflict", message: "Someone else changed this profile while you were editing. Reload to see their changes.", current: { version: p.version ?? 0, updatedBy: "", updatedAt: p.updatedAt ?? 0 } });

/** Creates a draft (no code) or saves changes. A live profile only takes words that pass the safety check. */
export async function saveSponsorProfile(input: SponsorInput): Promise<ActionResult<{ code: string; version: number }>> {
  const v = await requireStaff("sponsor.manage", "sponsor.publish");
  const fields = validate(input);
  if (Object.keys(fields).length) return actionError({ kind: "validation", fields });
  const creating = !input.code;
  if (creating && !has(v, "sponsor.manage")) return actionError({ kind: "forbidden", message: "Programme officers add new profiles." });
  const description = input.description.trim();
  const need = { amount: { amountMinor: toMinor(input.amount, input.currency), currency: input.currency }, period: input.period, description };

  return run(() =>
    getStore().runTransaction(async (tx) => {
      const now = Date.now();
      if (creating) {
        const code = await nextSponsorCode(tx, { now });
        const doc: SponsorProfile & { version: number } = {
          code,
          status: "draft",
          ageBand: input.ageBand,
          supportCategory: input.category,
          programmeId: SUPPORT_CATEGORY_PROGRAMME[input.category],
          country: input.country,
          need,
          funded: { amountMinor: 0, currency: input.currency },
          sponsorsNeeded: input.sponsorsNeeded,
          sponsorsCurrent: input.sponsorsCurrent,
          linkedSupportRef: has(v, "sponsor.manage") ? (input.linkedSupportRef ?? null) : null,
          review: null,
          publishedAt: null,
          publishedBy: null,
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        tx.create(docPath("sponsorProfiles", code), doc);
        auditTx(tx, { actor: actorOf(v), action: "sponsor.create", area: "donations", summary: `${v.displayName} drafted sponsorship profile ${code}`, feed: true, targetRef: code });
        return { code, version: 1 };
      }
      const code = input.code!;
      if (!SPONSOR_RE.test(code)) refuse(actionError({ kind: "not_allowed", message: "That profile doesn’t exist." }));
      const cur = await tx.get<SponsorProfile & { version?: number }>(docPath("sponsorProfiles", code));
      if (!cur) return refuse(actionError({ kind: "not_allowed", message: "That profile doesn’t exist." }));
      if ((cur.version ?? 0) !== input.expectedVersion) refuse(stale(cur));
      if (cur.status === "archived") refuse(actionError({ kind: "not_allowed", message: "This profile is archived. Bring it back first." }));
      const live = cur.status === "published" || cur.status === "fully_funded";
      const flags = safetyFlags(description);
      if (live && flags.length) refuse(actionError({ kind: "blocked", message: "This profile is live, so its words must pass the safety check.", reasons: reasonsOf(flags) }));
      const version = (cur.version ?? 0) + 1;
      tx.update(docPath("sponsorProfiles", code), {
        ageBand: input.ageBand,
        supportCategory: input.category,
        programmeId: SUPPORT_CATEGORY_PROGRAMME[input.category],
        country: input.country,
        need,
        sponsorsNeeded: input.sponsorsNeeded,
        sponsorsCurrent: input.sponsorsCurrent,
        ...(has(v, "sponsor.manage") && input.linkedSupportRef !== undefined ? { linkedSupportRef: input.linkedSupportRef } : {}),
        // Fully sponsored follows the counts on a live profile.
        ...(live ? { status: input.sponsorsCurrent >= input.sponsorsNeeded ? "fully_funded" : "published" } : {}),
        updatedAt: now,
        version,
      });
      auditTx(tx, { actor: actorOf(v), action: "sponsor.update", area: "donations", summary: `${v.displayName} updated sponsorship profile ${code}`, feed: false, targetRef: code });
      return { code, version };
    }),
  );
}

/** Puts a draft live (content managers and super admins) after the safety check and the reviewer's tick. */
export async function publishSponsorProfile(code: string, expectedVersion: number, reviewed: boolean): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("sponsor.publish");
  if (!reviewed) return actionError({ kind: "validation", fields: { reviewed: "Please confirm you’ve checked for names, precise places and medical history." } });
  return run(() =>
    getStore().runTransaction(async (tx) => {
      const cur = await tx.get<SponsorProfile & { version?: number }>(docPath("sponsorProfiles", code));
      if (!cur) return refuse(actionError({ kind: "not_allowed", message: "That profile doesn’t exist." }));
      if ((cur.version ?? 0) !== expectedVersion) refuse(stale(cur));
      if (cur.status !== "draft") refuse(actionError({ kind: "not_allowed", message: "Only drafts can be put live." }));
      const flags = safetyFlags(cur.need.description);
      if (flags.length) refuse(actionError({ kind: "blocked", message: "This can’t go live yet.", reasons: reasonsOf(flags) }));
      const now = Date.now();
      const version = (cur.version ?? 0) + 1;
      tx.update(docPath("sponsorProfiles", code), {
        status: cur.sponsorsCurrent >= cur.sponsorsNeeded ? "fully_funded" : "published",
        review: { by: v.uid, at: now },
        publishedAt: now,
        publishedBy: v.uid,
        updatedAt: now,
        version,
      });
      auditTx(tx, { actor: actorOf(v), action: "sponsor.publish", area: "donations", summary: `${v.displayName} put sponsorship profile ${code} live`, feed: true, targetRef: code });
      return { version };
    }),
  );
}

/** Takes a profile down to a draft, archives it, or brings an archived one back as a draft. */
export async function setSponsorStatus(code: string, expectedVersion: number, to: "draft" | "archived"): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("sponsor.manage", "sponsor.publish");
  return run(() =>
    getStore().runTransaction(async (tx) => {
      const cur = await tx.get<SponsorProfile & { version?: number }>(docPath("sponsorProfiles", code));
      if (!cur) return refuse(actionError({ kind: "not_allowed", message: "That profile doesn’t exist." }));
      if ((cur.version ?? 0) !== expectedVersion) refuse(stale(cur));
      const live = cur.status === "published" || cur.status === "fully_funded";
      if (to === "draft" && live && !has(v, "sponsor.publish")) refuse(actionError({ kind: "forbidden", message: "A content manager takes live profiles down." }));
      const now = Date.now();
      const version = (cur.version ?? 0) + 1;
      tx.update(docPath("sponsorProfiles", code), { status: to, ...(to === "draft" ? { review: null } : {}), updatedAt: now, version });
      auditTx(tx, {
        actor: actorOf(v),
        action: to === "archived" ? "sponsor.archive" : "sponsor.unpublish",
        area: "donations",
        summary: `${v.displayName} ${to === "archived" ? "archived" : live ? "took down" : "restored"} sponsorship profile ${code}`,
        feed: true,
        targetRef: code,
      });
      return { version };
    }),
  );
}

/** A programme-level update on a profile ("This term, the programme…"). Never about one child. */
export async function addSponsorUpdate(code: string, text: string): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("sponsor.manage", "sponsor.publish");
  const t = text.trim();
  if (t.length < 10 || t.length > 500) return actionError({ kind: "validation", fields: { update: "Please write between 10 and 500 characters." } });
  const flags = safetyFlags(t);
  if (flags.length) return actionError({ kind: "blocked", message: "Updates are about the programme, not one child.", reasons: reasonsOf(flags) });
  return run(() =>
    getStore().runTransaction(async (tx) => {
      const cur = await tx.get<SponsorProfile>(docPath("sponsorProfiles", code));
      if (!cur) return refuse(actionError({ kind: "not_allowed", message: "That profile doesn’t exist." }));
      const id = newId();
      const now = Date.now();
      tx.create(subDocPath("sponsorProfiles", code, "updates", id), { at: now, text: t, by: v.uid, published: true } satisfies SponsorUpdate);
      auditTx(tx, { actor: actorOf(v), action: "sponsor.update_post", area: "donations", summary: `${v.displayName} posted an update on ${code}`, feed: false, targetRef: code });
      return { id };
    }),
  );
}
