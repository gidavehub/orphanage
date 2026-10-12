// Partner logos (content-model §3.5). Today's five placeholder SVG badges from
// components/art/PartnerLogos.tsx, in today's order, as `builtin` logos.
// CLIENT: real partners need recorded permission before their logo is published; these placeholders
// are exempt while `placeholder: true` and are listed in the Before-launch checklist.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";

export const partnerSeeds: ItemSeed<"partners">[] = [
  { id: "care-alliance", placeholder: true, order: 1, name: "Care Alliance", logo: { builtin: "care-alliance" }, permission: { status: "pending" } },
  { id: "kids-first", placeholder: true, order: 2, name: "Kids First Fund", logo: { builtin: "kids-first" }, permission: { status: "pending" } },
  { id: "schools-trust", placeholder: true, order: 3, name: "United Schools Trust", logo: { builtin: "schools-trust" }, permission: { status: "pending" } },
  { id: "global-health", placeholder: true, order: 4, name: "International Health Partners", logo: { builtin: "global-health" }, permission: { status: "pending" } },
  { id: "carepoint", placeholder: true, order: 5, name: "Carepoint", logo: { builtin: "carepoint" }, permission: { status: "pending" } },
];
