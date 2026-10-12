// The Giving place's sub-tabs (admin-ux §6.6, PLAN D55): Gifts · Causes · Where it goes · Sponsorship,
// each shown only to the roles that can open it. Content managers and programme officers reach Giving
// for causes and sponsorship without seeing gifts.

import type { Permission } from "@/lib/model/permissions";

type Tab = "gifts" | "causes" | "where" | "sponsorship";

/** Single gifts and donor names (data-model §8). */
const GIFTS: Permission[] = ["donation.read", "donation.manage"];
/** Totals per programme and cause (donation.summary is totals only). */
const DONATIONS: Permission[] = [...GIFTS, "donation.summary"];

const TABS: Array<{ id: Tab; label: string; href: string; perms: Permission[] }> = [
  { id: "gifts", label: "Gifts", href: "/admin/giving", perms: GIFTS },
  { id: "causes", label: "Causes", href: "/admin/giving/causes", perms: [...DONATIONS, "content.edit"] },
  { id: "where", label: "Where it goes", href: "/admin/giving/where-it-goes", perms: DONATIONS },
  { id: "sponsorship", label: "Sponsorship", href: "/admin/giving/sponsorship", perms: ["sponsor.manage", "sponsor.publish"] },
];

/** The tabs this person can open; `can` is `(p) => has(viewer, p)`. */
export function givingTabs(current: Tab, can: (p: Permission) => boolean) {
  return TABS.filter((t) => t.perms.some(can)).map((t) => ({ label: t.label, href: t.href, current: t.id === current }));
}

/** Where someone without the ledger lands when they open Giving. */
export function firstGivingTab(can: (p: Permission) => boolean): string | null {
  return TABS.find((t) => t.perms.some(can))?.href ?? null;
}
