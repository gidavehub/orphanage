// The stats registry (content-model §3.5, PLAN D45–D47). Sections reference figures by id, so one
// figure ("45+ partners") stays consistent everywhere. Values, labels and notes verbatim from
// content/home.ts → impact.stats, restoring.stats and partners.title today.
// CLIENT: only verified statistics may be published (ToR §3). Every value below is a placeholder:
// it renders with the placeholder note and an "Illustrative" chip until a permitted person verifies
// it, and never once the super admin switches on settings.site.figures.hideUnverified (D46).
// The ToR §3 figures the landing never showed (medical cases, volunteers and partners, donations
// received and distributed) carry illustrative values consistent with the landing figures and the
// FY2025 allocation summary (content/seed/allocation.ts), so /impact shows the full D45 set with the
// "Illustrative" chip. `asOf` is the placeholder counting date. All of it is CLIENT data.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";

const PLACEHOLDER = { status: "placeholder" } as const;
/** CLIENT: the date the placeholder figures were "counted". */
const AS_OF = "2026-09-30";

export const statSeeds: ItemSeed<"stats">[] = [
  {
    id: "children-supported",
    placeholder: true,
    order: 1,
    label: "Children supported",
    value: 1200,
    suffix: "+",
    note: "Children reached through education, medical and protection support.",
    kind: "programme",
    tone: "clay",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "families-reached",
    placeholder: true,
    order: 2,
    label: "Families reached",
    value: 640,
    suffix: "+",
    note: "Caregivers and households strengthened with guidance and referrals.",
    kind: "programme",
    tone: "marigold",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "school-fee-interventions",
    placeholder: true,
    order: 3,
    label: "School-Fee Interventions",
    value: 980,
    suffix: "+",
    note: "Fees, uniforms and books paid so that children could stay in school.",
    kind: "programme",
    tone: "forest",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "counselling-sessions",
    placeholder: true,
    order: 4,
    label: "Counselling sessions",
    value: 3200,
    suffix: "+",
    note: "Sessions facilitated with qualified counsellors and professionals.",
    kind: "programme",
    tone: "cocoa",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "active-volunteers",
    placeholder: true,
    order: 5,
    label: "Active Volunteers",
    value: 150,
    suffix: "+",
    kind: "organisation",
    tone: "marigold",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "community-partners",
    placeholder: true,
    order: 6,
    label: "Community Partners",
    value: 45,
    suffix: "+",
    kind: "organisation",
    tone: "deep",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "monthly-donors",
    placeholder: true,
    order: 7,
    label: "Monthly Donors",
    value: 400,
    suffix: "+",
    kind: "finance",
    tone: "coral",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  // ToR §3 figures for /impact (CLIENT: illustrative until counted and verified).
  {
    id: "medical-cases",
    placeholder: true,
    order: 8,
    label: "Medical cases supported",
    value: 260,
    suffix: "+",
    note: "Children helped with check-ups, treatment, medicines and referrals.",
    kind: "programme",
    tone: "clay",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "volunteers-partners",
    placeholder: true,
    order: 9,
    label: "Volunteers and partners engaged",
    value: 195,
    suffix: "+",
    note: "Volunteers and community partners giving their time and skills.",
    kind: "organisation",
    tone: "umber",
    verification: PLACEHOLDER,
    asOf: AS_OF,
  },
  {
    id: "donations-received",
    placeholder: true,
    order: 10,
    label: "Donations received",
    value: 48500,
    kind: "finance",
    tone: "coral",
    amounts: { USD: 48500 },
    verification: PLACEHOLDER,
    asOf: "2025-12-31", // CLIENT: the end of the financial year the allocation summary covers
  },
  {
    id: "donations-distributed",
    placeholder: true,
    order: 11,
    label: "Donations distributed",
    value: 47400,
    kind: "finance",
    tone: "forest",
    amounts: { USD: 47400 },
    verification: PLACEHOLDER,
    asOf: "2025-12-31", // CLIENT: the end of the financial year the allocation summary covers
  },
];
