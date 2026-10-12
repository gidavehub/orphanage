import "server-only";

// Giving › Where it goes: the annual "where the money went" summaries for /impact (PLAN D57). Finance
// keeps them per financial year and currency (never summed across currencies) and verifies them; a
// new year is prefilled from what has been put towards each programme so far. Writes go through
// saveItem (collection `allocationSummaries`, finance and super admins only).

import { canCreateItem, canEditCollection } from "@/lib/content/access";
import { getCauseTotals } from "@/lib/content/public";
import { contentStore } from "@/lib/content/store";
import type { Item, Visibility } from "@/lib/content/types";
import { CURRENCIES, PROGRAMME_IDS, PROGRAMME_SLUG, type Currency, type Millis } from "@/lib/model/enums";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import { fromMinor } from "@/lib/money";
import { requireStaff } from "@/lib/server/auth/session";
import { getOrgSettings } from "@/lib/server/public/settings";
import { staffRefs } from "./_shared";

type Summary = Item<"allocationSummaries">;

export type AllocationSummaryRow = {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  currencies: Currency[];
  verified: boolean;
  placeholder: boolean;
  hasDraft: boolean;
  visibility: Visibility;
};

export async function listAllocationSummaries(): Promise<{ rows: AllocationSummaryRow[]; canEdit: boolean }> {
  const v = await requireStaff("donation.read", "donation.summary", "donation.manage");
  const records = await contentStore().listItems("allocationSummaries");
  const rows = records
    .filter((r) => r.visibility !== "archived" && (r.draft ?? r.published))
    .map((r) => {
      const s = (r.draft ?? r.published) as Summary;
      return {
        id: r.id,
        label: s.label,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        currencies: CURRENCIES.filter((c) => s.byCurrency?.[c]),
        verified: s.verification?.status === "verified",
        placeholder: r.placeholder === true,
        hasDraft: r.draft !== null,
        visibility: r.visibility,
      };
    })
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return { rows, canEdit: canEditCollection(v.roles, "allocationSummaries") };
}

export type AllocationSummaryEditorDTO = {
  id: string | null;
  version: number;
  everLive: boolean;
  hasDraft: boolean;
  value: Summary;
  verifiedBy: string | null;
  verifiedAt: Millis | null;
};

/** One summary for the editor, or a new financial year prefilled from programme totals. */
export async function getAllocationSummaryForEditor(id: string): Promise<AllocationSummaryEditorDTO | null> {
  const v = await requireStaff("donation.manage", "cause.figures");
  if (!canEditCollection(v.roles, "allocationSummaries")) return null;
  if (id === "new") {
    if (!canCreateItem(v.roles, "allocationSummaries")) return null;
    const [totals, org, existing] = await Promise.all([getCauseTotals(), getOrgSettings(), contentStore().listItems("allocationSummaries")]);
    const latestEnd = existing.map((r) => ((r.draft ?? r.published) as Summary | null)?.periodEnd ?? "").sort().at(-1);
    const startYear = latestEnd ? Number(latestEnd.slice(0, 4)) + 1 : new Date().getUTCFullYear();
    const m = String(org.financialYearStartMonth).padStart(2, "0");
    const end = new Date(Date.UTC(startYear + 1, org.financialYearStartMonth - 1, 0)).toISOString().slice(0, 10);
    const byCurrency: Summary["byCurrency"] = {};
    for (const c of CURRENCIES) {
      const lines = PROGRAMME_IDS.map((p) => ({ key: p, label: PROGRAMME_LABEL[p], amount: fromMinor(totals[PROGRAMME_SLUG[p]]?.[c]?.raisedMinor ?? 0, c) })).filter((l) => l.amount > 0);
      if (lines.length) byCurrency[c] = { received: lines.reduce((s, l) => s + l.amount, 0), lines };
    }
    return {
      id: null,
      version: 0,
      everLive: false,
      hasDraft: false,
      value: {
        order: 1,
        label: `Financial year ${startYear}`,
        periodStart: `${startYear}-${m}-01`,
        periodEnd: end,
        byCurrency,
        verification: { status: "placeholder" },
      } as Summary,
      verifiedBy: null,
      verifiedAt: null,
    };
  }
  const [rec, staff] = await Promise.all([contentStore().getItem("allocationSummaries", id), staffRefs()]);
  if (!rec || !(rec.draft ?? rec.published)) return null;
  const value = (rec.draft ?? rec.published) as Summary;
  const vf = value.verification;
  return {
    id: rec.id,
    version: rec.version,
    everLive: Boolean(rec.published),
    hasDraft: Boolean(rec.draft),
    value,
    verifiedBy: vf?.status === "verified" && vf.verifiedBy ? (staff.get(vf.verifiedBy)?.name ?? "a former team member") : null,
    verifiedAt: vf?.status === "verified" ? (vf.verifiedAt ?? null) : null,
  };
}
