import "server-only";

// Integration status cards (integrations §2.2) for Settings › Connections, the boot log and the
// practice ribbon. Env-only and cheap: no network calls. checkIntegration() ("Check again") is
// env-only for now; I6 adds harmless live probes in lib/server/integrations/probe.ts.
// Only variable NAMES are ever shown, never values.

import { COPY } from "@/lib/admin/copy";
import type { IntegrationStatus } from "@/lib/model/dto";
import { env, features, resolveBackend } from "@/lib/server/env";
import { emailMode, maskAddress } from "@/lib/server/email/provider";

function firebaseStatus(): IntegrationStatus {
  let backend: ReturnType<typeof resolveBackend> | "error";
  try {
    backend = resolveBackend();
  } catch {
    backend = "error";
  }
  const envNames = ["FIREBASE_SERVICE_ACCOUNT_JSON", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "HAVEN_DATA_KEY"];
  if (backend === "firestore") {
    if (!env.dataKey.key) {
      return { id: "firebase", state: "problem", headline: "Data key missing", meaning: "Records are stored in Firebase, but protected fields can't be saved until HAVEN_DATA_KEY is set.", envNames };
    }
    return { id: "firebase", state: "connected", headline: "Connected to Firebase", meaning: "Records and files are stored securely in Haven's Firebase project.", envNames };
  }
  if (backend === "local") {
    return {
      id: "firebase",
      state: "off",
      headline: "Practice mode",
      meaning: "Everything is saved on this computer only, with practice records. Connect Firebase before launch.",
      envNames,
    };
  }
  return {
    id: "firebase",
    state: "problem",
    headline: "Data storage isn't connected",
    meaning: "Forms can't save anything yet and the public site shows built-in content. Add the Firebase service account.",
    envNames,
  };
}

function stripeStatus(): IntegrationStatus {
  const envNames = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CURRENCIES"];
  if (!features.stripe) {
    return { id: "stripe", state: "off", headline: "Card payments are off", meaning: "People can still pledge, and you can record gifts here. Card payments start once Stripe is connected.", envNames };
  }
  if (!features.stripeLive) {
    return { id: "stripe", state: "test", headline: "Card payments are in test mode", meaning: "Only test cards work. Test gifts are not counted in totals.", envNames };
  }
  if (!features.stripeWebhook && env.vercelEnv === "production") {
    return {
      id: "stripe",
      state: "problem",
      headline: "Confirmations rely on the backup check",
      meaning: "Payments can start, but renewals, failed payments and refunds aren't seen until the webhook secret is set.",
      envNames,
    };
  }
  return { id: "stripe", state: "connected", headline: "Card payments are on", meaning: `Cards are accepted in ${env.stripe.currencies.join(", ")} where Settings › Giving allows.`, envNames };
}

function emailStatus(): IntegrationStatus {
  const envNames = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REDIRECT_TO", "EMAIL_PROVIDER"];
  const mode = emailMode();
  if (mode === "mailbox") return { id: "email", state: "off", headline: "Emails wait in the Outbox", meaning: COPY["integration.emailOff"], envNames };
  if (mode === "redirect") {
    return { id: "email", state: "test", headline: "Test emails only", meaning: `All emails go to ${maskAddress(env.email.redirectTo ?? "")} instead of the real people.`, envNames };
  }
  return { id: "email", state: "connected", headline: "Emails are being sent", meaning: "Haven sends emails through Resend from your sending domain.", envNames };
}

function aiStatus(): IntegrationStatus {
  const envNames = ["AI_PROVIDER", "ANTHROPIC_API_KEY", "GOOGLE_CLOUD_PROJECT", "GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (!features.ai) {
    return { id: "ai", state: "off", headline: "The writing helper is off", meaning: "Monthly stories start from a fill-in template. A person always reviews before anything goes live.", envNames };
  }
  const anthropic = features.anthropic && env.ai.provider !== "gemini";
  const model = anthropic ? env.ai.anthropicModel : env.ai.geminiTextModel;
  return { id: "ai", state: "connected", headline: "The writing helper is on", meaning: `Drafts are written with ${model}. A person always reviews before anything goes live.`, envNames };
}

function zoomStatus(): IntegrationStatus {
  const envNames = ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_DEFAULT_HOST"];
  if (!features.zoomApi) {
    return { id: "zoom", state: "off", headline: "Paste links by hand", meaning: "Counsellors paste their Zoom link when booking. Invitations and reminders still work.", envNames };
  }
  return { id: "zoom", state: "connected", headline: "Zoom is connected", meaning: "Staff can create a Zoom meeting when booking a session.", envNames };
}

/** Every integration's status, from the environment only. Never throws. */
export function integrationStatuses(): IntegrationStatus[] {
  return [firebaseStatus(), stripeStatus(), emailStatus(), aiStatus(), zoomStatus()];
}

/** "Check again" for one integration (env-only until I6 adds probes). */
export async function checkIntegration(id: IntegrationStatus["id"]): Promise<IntegrationStatus> {
  const found = integrationStatuses().find((s) => s.id === id);
  if (!found) throw new Error(`Unknown integration: ${id}`);
  return found;
}

export type PracticeRibbon = { message: string; actionLabel: string; href: string };

/** The sand practice-mode ribbon for the admin shell (admin-ux §3.7), or null outside practice mode. */
export function practiceRibbon(): PracticeRibbon | null {
  if (!features.practiceMode) return null;
  return { message: COPY["ribbon.practice"], actionLabel: COPY["ribbon.practiceAction"], href: "/admin/settings/email-log" };
}

/** One boot-log line: "data=local stripe=off email=mailbox ai=off zoom=manual turnstile=off". */
export function statusLine(): string {
  let data: string;
  try {
    data = resolveBackend();
  } catch {
    data = "error";
  }
  const stripe = features.stripe ? (features.stripeLive ? "live" : "test") : "off";
  return `data=${data} stripe=${stripe} email=${emailMode()} ai=${features.ai ? "on" : "off"} zoom=${features.zoomApi ? "api" : "manual"} turnstile=${features.turnstile ? "on" : "off"}`;
}
