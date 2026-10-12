// Library seeds (PLAN D6): every resource route needs at least one entry, so the library starts with
// one request-only placeholder, "Annual report 2025". Read by lib/server/public/resources.ts (the
// public reader falls back to these when the `resources` collection is empty) and by the practice seed.
// The shape is data-model's Resource (lib/model/domain/library.ts) without the storage envelope.

import "server-only";

import type { Block } from "@/lib/content/schema";
import type { Resource } from "@/lib/model/domain/library";

export type ResourceSeed = Omit<Resource, "createdAt" | "updatedAt" | "version" | "executiveSummary"> & {
  id: string;
  executiveSummary: Block[];
};

export const resourceSeeds: ResourceSeed[] = [
  {
    // CLIENT: replace with the published annual report when it exists.
    id: "annual-report-2025",
    slug: "annual-report-2025",
    status: "published",
    access: "controlled",
    category: "annual_reports",
    title: "Annual report 2025",
    shortDescription: "Our report on the year's work with children and families. Ask us for a copy and our team will send it to you.",
    executiveSummary: [
      {
        id: "s1",
        type: "paragraph",
        text: "A summary of Haven's work in 2025 across child protection, education, health, counselling, legal support and family support, with verified figures and how every gift was used.",
      },
    ],
    coverMediaId: null,
    publicationDate: Date.UTC(2026, 0, 31),
    programmeIds: [],
    language: "English",
    file: null,
    preview: null,
    downloadCount: 0,
    requestCount: 0,
    featured: true,
    placeholder: true,
    publishedAt: Date.UTC(2026, 0, 31),
    publishedBy: null,
  },
];
