import "server-only";

// The boot report (integrations §8.2, PLAN D110): one line of what is connected, and the NAMES of the
// production variables that are still missing (never their values). Logged once per server start by
// instrumentation.ts. On Vercel production a missing [PROD] variable is an error line, elsewhere info.

import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { statusLine } from "@/lib/server/integrations/status";

/** Variables tagged [PROD] in .env.example: set them in Vercel Production before launch. */
export const PROD_VARIABLES = [
  "NEXT_PUBLIC_SITE_URL",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "HAVEN_DATA_KEY",
  "HAVEN_DATA_KEY_ID",
  "HAVEN_HMAC_SECRET",
  "HAVEN_LOOKUP_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
] as const;

export function missingProdVariables(): string[] {
  return PROD_VARIABLES.filter((name) => !process.env[name]?.trim());
}

let reported = false;

export function bootReport(): void {
  if (reported) return;
  reported = true;
  try {
    const missing = missingProdVariables();
    log.info("boot", { status: statusLine() });
    if (missing.length) {
      const fields = { missing: missing.join(","), note: "Set these in Vercel Production before launch (names only; values are never logged)." };
      if (env.vercelEnv === "production") log.error("boot.missing_prod_variables", fields);
      else log.info("boot.missing_prod_variables", fields);
    }
  } catch (err) {
    log.warn("boot.report_failed", { err });
  }
}
