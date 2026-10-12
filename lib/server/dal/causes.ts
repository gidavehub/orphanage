import "server-only";

// Giving › Causes for staff (admin-ux §6.6; PLAN D37–D39, D56). Reads the stored records (drafts and
// hidden causes included, which the public readers skip) and adds what has been raised from
// `causeTotals`. Writes go through lib/content/actions saveItem, whose field groups keep goals,
// currencies and breakdowns with finance (FO money, CM words).

import { COLLECTIONS } from "@/lib/content/registry";
import { canEditCollection, canEditPath, canCreateItem } from "@/lib/content/access";
import { getCauseTotals } from "@/lib/content/public";
import { loadDoc } from "@/lib/content/read";
import { contentStore } from "@/lib/content/store";
import type { Item, Visibility } from "@/lib/content/types";
import { getMediaIndex, toPickerItem } from "@/lib/media/index";
import type { MediaPickerItem } from "@/lib/model/dto";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import { fromMinor } from "@/lib/money";
import { routes } from "@/lib/routes";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { countries } from "@/content/world";
import { staffRefs } from "./_shared";

type Cause = Item<"causes">;

/** The state chip on a cause card (D39): derived, never stored. */
export type CauseState = "Live" | "Upcoming" | "Paused" | "Ended" | "Hidden" | "Not live yet";

export type CauseRowDTO = {
  id: string;
  slug: string;
  title: string;
  season: string;
  kind: Cause["kind"];
  state: CauseState;
  currency: Currency;
  goal: number;
  /** Major units in the cause's currency: opening balance + online/recorded gifts + converted. */
  raised: number;
  percent: number;
  /** Major units given in other currencies (never added in). */
  others: Array<{ currency: Currency; amount: number }>;
  verified: boolean;
  placeholder: boolean;
  hasDraft: boolean;
  href: string;
};

function stateOf(c: Cause, visibility: Visibility, isLive: boolean, now: number): CauseState {
  if (!isLive) return "Not live yet";
  if (visibility !== "live") return "Hidden";
  if (c.status === "completed" || (c.endsAt !== undefined && c.endsAt <= now)) return "Ended";
  if (c.status === "paused") return "Paused";
  if (c.startsAt !== undefined && c.startsAt > now) return "Upcoming";
  return "Live";
}

function raisedOf(c: Cause, totals: Partial<Record<Currency, { raisedMinor: number }>>) {
  const own = totals[c.currency]?.raisedMinor ?? 0;
  const raised = (c.offlineRaised ?? 0) + fromMinor(own, c.currency) + (c.convertedRaised ?? 0);
  const others = CURRENCIES.filter((k) => k !== c.currency && (totals[k]?.raisedMinor ?? 0) > 0).map((k) => ({ currency: k, amount: fromMinor(totals[k]!.raisedMinor, k) }));
  return { raised, percent: c.goal > 0 ? (raised / c.goal) * 100 : 0, others };
}

/** Every cause, with its derived state and what it has raised (drafts shown with their draft wording). */
export async function listCausesForStaff(): Promise<CauseRowDTO[]> {
  await requireStaff("donation.read", "donation.summary", "donation.manage", "content.edit");
  const [records, totals] = await Promise.all([contentStore().listItems("causes"), getCauseTotals()]);
  const now = Date.now();
  return records
    .filter((r) => r.visibility !== "archived" && (r.draft ?? r.published))
    .map((r) => {
      const c = (r.draft ?? r.published) as Cause;
      const live = (r.published as Cause | null) ?? c;
      const money = raisedOf(live, totals[live.slug] ?? {});
      return {
        id: r.id,
        slug: c.slug,
        title: c.title,
        season: c.season,
        kind: c.kind,
        state: stateOf(live, r.visibility, r.published !== null, now),
        currency: live.currency,
        goal: live.goal,
        ...money,
        verified: live.verification?.status === "verified",
        placeholder: r.placeholder === true,
        hasDraft: r.draft !== null,
        href: routes.donate(c.slug),
      };
    })
    .sort((a, b) => {
      const ca = records.find((r) => r.id === a.id)!;
      const cb = records.find((r) => r.id === b.id)!;
      return (((ca.draft ?? ca.published) as Cause).order ?? 0) - (((cb.draft ?? cb.published) as Cause).order ?? 0);
    });
}

export type CauseEditorDTO = {
  /** null when adding a new cause. */
  id: string | null;
  version: number;
  visibility: Visibility;
  /** Has been live at least once (the web address is frozen). */
  everLive: boolean;
  hasDraft: boolean;
  placeholder: boolean;
  value: Cause;
  can: { money: boolean; words: boolean; publish: boolean; create: boolean };
  /** Why the money fields are locked, in plain words. */
  moneyLock: string;
  /** Major units recorded through Giving, per currency (computed, never typed). */
  recorded: Partial<Record<Currency, number>>;
  verifiedBy: string | null;
  media: MediaPickerItem[];
  countries: Array<{ code: string; name: string }>;
  /** The home page's appeal groups (a cause shows there when it belongs to one). */
  groups: Array<{ id: string; label: string }>;
  href: string;
};

const BLANK: Cause = {
  slug: "",
  kind: "appeal",
  order: 50,
  featured: false,
  title: "",
  season: "",
  groupId: "",
  tone: "forest",
  image: { $media: "appeal-education" },
  summary: "",
  story: [],
  currency: "USD",
  goal: 0,
  offlineRaised: 0,
  convertedRaised: 0,
  allocation: [],
  impactUnits: [],
  presetAmounts: {},
  verification: { status: "placeholder" },
  defaultFrequency: "one_time",
  allowedFrequencies: ["one_time", "monthly", "quarterly", "annual"],
  inKindItems: [],
  zakatEligible: false,
  status: "active",
  seo: {},
} as unknown as Cause;

/** One cause for the editor (or a blank one for "new"), with what this person may change. 404s otherwise. */
export async function getCauseForEditor(id: string): Promise<CauseEditorDTO | null> {
  const v = await requireStaff("content.edit", "donation.manage");
  if (!canEditCollection(v.roles, "causes")) return null;
  const spec = COLLECTIONS.causes;
  const isNew = id === "new";
  const rec = isNew ? null : await contentStore().getItem("causes", id);
  if (!isNew && (!rec || !(rec.draft ?? rec.published))) return null;
  const value = rec ? ((rec.draft ?? rec.published) as Cause) : BLANK;
  const [totals, index, staff, appeals] = await Promise.all([getCauseTotals(), getMediaIndex(), staffRefs(), loadDoc("home.appeals")]);
  const t = totals[value.slug] ?? {};
  const recorded: Partial<Record<Currency, number>> = {};
  for (const k of CURRENCIES) if ((t[k]?.raisedMinor ?? 0) > 0) recorded[k] = fromMinor(t[k]!.raisedMinor, k);
  const money = canEditPath(v.roles, spec, "goal", value);
  return {
    id: rec?.id ?? null,
    version: rec?.version ?? 0,
    visibility: rec?.visibility ?? "live",
    everLive: Boolean(rec?.published),
    hasDraft: Boolean(rec?.draft),
    placeholder: rec?.placeholder === true,
    value,
    can: { money, words: canEditPath(v.roles, spec, "title", value), publish: has(v, "content.publish"), create: canCreateItem(v.roles, "causes") },
    moneyLock: spec.fieldGroups[0]?.message ?? "Only the finance team can change amounts.",
    recorded,
    verifiedBy:
      value.verification?.status === "verified" && value.verification.verifiedBy
        ? (staff.get(value.verification.verifiedBy)?.name ?? (value.verification.verifiedBy.startsWith("dev-") ? "the practice account" : "a former team member"))
        : null,
    media: Object.values(index)
      .filter((a) => a.kind === "image")
      .map((a) => toPickerItem(a)),
    countries: countries.map((c) => ({ code: c.code, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    groups: appeals.groups.map((g) => ({ id: g.id, label: g.label })),
    href: routes.donate(value.slug || "new"),
  };
}
