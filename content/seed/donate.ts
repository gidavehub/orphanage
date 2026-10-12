// donate.config seed (PLAN D63): display configuration for the donate widget (landing and /donate).
// Values verbatim from content/home.ts → donate today. Payment routing, instructions, FX and limits
// are the system doc settings/payment (lib/model/domain/settings.ts), not content.

import "server-only";

import type { DocSeed } from "@/lib/content/types";

export const donateConfigSeed = {
  // Today's widget opens on dalasi.
  defaultCurrency: "GMD",
  // Preset amounts per currency (international donors); `min` gates the Donate button.
  currencies: {
    GMD: { enabled: true, name: "Dalasi", min: 100, amounts: [500, 1000, 2500, 5000, 10000, 25000] },
    USD: { enabled: true, name: "US dollars", min: 5, amounts: [10, 25, 50, 100, 250, 500] },
    GBP: { enabled: true, name: "Pounds", min: 5, amounts: [10, 20, 50, 100, 200, 500] },
    EUR: { enabled: true, name: "Euros", min: 5, amounts: [10, 25, 50, 100, 250, 500] },
  },
  frequencies: { one_time: true, monthly: true, quarterly: true, annual: true },
  inKind: [
    "School materials",
    "Clothing",
    // Client spec §8 (lead decision, F3 request).
    "Bedding",
    "Food supplies",
    "Medical supplies",
    "Computers or learning devices",
    "Furniture",
    "Professional services",
    "Other approved items",
  ],
} satisfies DocSeed<"donate.config">;
