// Annual allocation summaries (PLAN D57): "where the money went", per financial year and currency.
// The finance team fills these in from Giving › Where it went (prefilled from allocations) and
// verifies them. Until then the one seed is an illustrative placeholder: /impact shows it with the
// "Illustrative" treatment (like the seeded impact figures, D46), and hides it for good once the
// super admin switches on settings.site.figures.hideUnverified before launch.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";

export const allocationSeeds: ItemSeed<"allocationSummaries">[] = [
  {
    id: "fy-2025",
    placeholder: true,
    order: 1,
    label: "Financial year 2025",
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    // CLIENT: illustrative amounts. Replace with the verified amounts received and spent per programme,
    // in each currency (never summed across currencies), then verify.
    byCurrency: {
      USD: {
        received: 48500,
        lines: [
          { key: "education", label: "Education Assistance", amount: 14200, tone: "forest" },
          { key: "medical", label: "Medical Support", amount: 9800, tone: "clay" },
          { key: "protection", label: "Child Protection", amount: 6100, tone: "deep" },
          { key: "family", label: "Family & Community", amount: 5400, tone: "marigold" },
          { key: "psychological", label: "Psychological Support", amount: 4300, tone: "cocoa" },
          { key: "legal", label: "Legal Support", amount: 2600, tone: "umber" },
          { key: "admin", label: "Running costs and payment fees", amount: 5000, tone: "coral" },
        ],
      },
    },
    verification: { status: "placeholder" },
    reportResourceSlug: "annual-report-2025",
    note: "Money not spent by the end of the year is carried into the next year's programmes.",
  },
];
