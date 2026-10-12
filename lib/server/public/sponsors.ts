import "server-only";

// Published sponsorship profiles for /get-involved/sponsor (PLAN D55, D82; data-model §4.6). Cached
// ('use cache' + cacheLife('content') + cacheTag(TAG.col('sponsorProfiles'))) and built field by field
// as SponsorProfilePublic DTOs: the code, a broad age band, category, programme, broad country, the
// need, sponsor counts and the latest programme-level update. Never `linkedSupportRef`, reviewers or
// funding history. Only `published` and `fully_funded` profiles are listed. Writers (A4) call
// updateTag(TAG.col('sponsorProfiles')) and TAG.item('sponsorProfiles', code).

import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { SponsorProfile, SponsorUpdate } from "@/lib/model/domain/sponsor";
import type { SponsorProfilePublic } from "@/lib/model/dto";
import { AGE_BANDS, CURRENCIES, PROGRAMME_IDS, SUPPORT_CATEGORIES, type AgeBand, type Currency, type SupportCategory } from "@/lib/model/enums";
import { SPONSOR_RE } from "@/lib/model/refs";
import { getStore } from "@/lib/server/db";
import { C, subPath } from "@/lib/server/db/collections";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

type Stored = Partial<SponsorProfile> & { id: string };

const PUBLIC_STATUSES = ["published", "fully_funded"] as const;
const PERIODS = ["one_off", "per_term", "per_month", "per_year"] as const;

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/** The newest published programme-level update, or null. */
async function latestUpdate(code: string): Promise<SponsorProfilePublic["lastUpdate"]> {
  try {
    const page = await getStore().list<SponsorUpdate>(subPath("sponsorProfiles", code, "updates"), { orderBy: { field: "at", dir: "desc" }, limit: 10 });
    const u = page.items.find((x) => x.published === true && typeof x.text === "string" && typeof x.at === "number");
    return u ? { at: u.at, text: u.text.slice(0, 500) } : null;
  } catch (err) {
    log.warn("public.sponsor_updates_read_failed", { code, err });
    return null;
  }
}

async function toPublic(p: Stored): Promise<SponsorProfilePublic | null> {
  const code = typeof p.code === "string" ? p.code : p.id;
  if (!SPONSOR_RE.test(code) || !oneOf(PUBLIC_STATUSES, p.status)) return null;
  const need = p.need;
  if (!need || !need.amount || !oneOf(CURRENCIES, need.amount.currency) || typeof need.amount.amountMinor !== "number") return null;
  if (!oneOf(SUPPORT_CATEGORIES, p.supportCategory) || !oneOf(PROGRAMME_IDS, p.programmeId)) return null;
  return {
    code,
    ageBand: oneOf(AGE_BANDS, p.ageBand) ? p.ageBand : "unknown",
    category: p.supportCategory,
    programmeId: p.programmeId,
    country: typeof p.country === "string" && /^[a-z]{2}$/.test(p.country) ? p.country : null,
    need: typeof need.description === "string" ? need.description.slice(0, 300) : "",
    amount: { amountMinor: Math.max(0, Math.round(need.amount.amountMinor)), currency: need.amount.currency as Currency },
    period: oneOf(PERIODS, need.period) ? need.period : "one_off",
    sponsorsNeeded: typeof p.sponsorsNeeded === "number" ? Math.max(0, Math.round(p.sponsorsNeeded)) : 0,
    sponsorsCurrent: typeof p.sponsorsCurrent === "number" ? Math.max(0, Math.round(p.sponsorsCurrent)) : 0,
    status: p.status,
    lastUpdate: await latestUpdate(code),
  };
}

/** Published and fully funded profiles (published first, then by most recently published). */
export async function getSponsorProfiles(o?: { category?: SupportCategory; ageBand?: AgeBand }): Promise<SponsorProfilePublic[]> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("sponsorProfiles"));
  let rows: Stored[] = [];
  try {
    const page = await getStore().list<Partial<SponsorProfile>>(C.sponsorProfiles, {
      where: [{ field: "status", op: "in", value: [...PUBLIC_STATUSES] }],
      orderBy: { field: "publishedAt", dir: "desc" },
      limit: 100,
    });
    rows = page.items;
  } catch (err) {
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    log.error("public.sponsors_read_failed", { err });
    return [];
  }
  const out = (await Promise.all(rows.map(toPublic))).filter((x): x is SponsorProfilePublic => x !== null);
  return out
    .filter((x) => (!o?.category || x.category === o.category) && (!o?.ageBand || x.ageBand === o.ageBand))
    .sort((a, b) => Number(a.status === "fully_funded") - Number(b.status === "fully_funded"));
}
