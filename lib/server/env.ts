import "server-only";

// The only reader of process.env (PLAN §4.6), apart from NEXT_PUBLIC_* reads in lib/client/firebase.ts
// and components/analytics/SiteAnalytics.tsx. Never log or return secret values to clients; pass modes
// to client components as props (integrations §2.1). Backend resolution follows PLAN §4.3 and D33–D35.

import { createHash } from "node:crypto";
import { CURRENCIES, type Currency } from "@/lib/model/enums";

export type Backend = "firestore" | "local" | "unavailable";
export type VercelEnv = "production" | "preview" | "development";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
};

export type FirebaseServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

/** A trimmed value, or null when missing or blank. */
function val(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t ? t : null;
}

function warn(message: string): void {
  console.warn(`[haven] ${message}`);
}

function currencies(list: string | null): Currency[] {
  const wanted = (list ?? "USD,GBP,EUR").split(",").map((x) => x.trim().toUpperCase());
  return CURRENCIES.filter((c) => wanted.includes(c));
}

function oldDataKeys(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"));
    }
  } catch {
    // fall through
  }
  warn("HAVEN_DATA_KEYS_OLD is not a JSON object of key ids to keys; ignoring it.");
  return {};
}

const vercelEnvRaw = val(process.env.VERCEL_ENV);
const onVercel = process.env.VERCEL === "1";

const webApiKey = val(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
const webAuthDomain = val(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
const webProjectId = val(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const webStorageBucket = val(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
const webAppId = val(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

const backendOverrideRaw = val(process.env.HAVEN_BACKEND)?.toLowerCase() ?? null;
const emailProviderRaw = val(process.env.EMAIL_PROVIDER)?.toLowerCase() ?? "auto";
const aiProviderRaw = val(process.env.AI_PROVIDER)?.toLowerCase() ?? "auto";

export const env = {
  nodeEnv: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",
  vercelEnv: (vercelEnvRaw === "production" || vercelEnvRaw === "preview" || vercelEnvRaw === "development"
    ? vercelEnvRaw
    : onVercel
      ? "preview"
      : "development") as VercelEnv,
  onVercel,
  /** Deployment host without protocol (Vercel sets it). */
  vercelUrl: val(process.env.VERCEL_URL),
  vercelProductionUrl: val(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  /** Canonical origin without a trailing slash. */
  siteUrl: val(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, "") ?? null,
  /** HAVEN_BACKEND: "firestore" | "local" forces a mode; anything else is ignored. */
  backendOverride: (backendOverrideRaw === "firestore" || backendOverrideRaw === "local" ? backendOverrideRaw : null) as
    | "firestore"
    | "local"
    | null,
  cronSecret: val(process.env.CRON_SECRET),
  hmacSecret: val(process.env.HAVEN_HMAC_SECRET),
  lookupSecret: val(process.env.HAVEN_LOOKUP_SECRET),
  dataKey: {
    id: val(process.env.HAVEN_DATA_KEY_ID) ?? "k1",
    key: val(process.env.HAVEN_DATA_KEY),
    old: oldDataKeys(val(process.env.HAVEN_DATA_KEYS_OLD)),
  },
  firebase: {
    serviceAccountJson: val(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    storageBucket: webStorageBucket,
    webConfig:
      webApiKey && webAuthDomain && webProjectId && webStorageBucket && webAppId
        ? ({ apiKey: webApiKey, authDomain: webAuthDomain, projectId: webProjectId, storageBucket: webStorageBucket, appId: webAppId } as FirebaseWebConfig)
        : null,
  },
  local: {
    adminEmail: val(process.env.LOCAL_ADMIN_EMAIL),
    adminPassword: val(process.env.LOCAL_ADMIN_PASSWORD),
    seedPassword: val(process.env.LOCAL_SEED_PASSWORD),
  },
  stripe: {
    secretKey: val(process.env.STRIPE_SECRET_KEY),
    webhookSecret: val(process.env.STRIPE_WEBHOOK_SECRET),
    /** What the Stripe account can technically charge (default USD, GBP, EUR). */
    currencies: currencies(val(process.env.STRIPE_CURRENCIES)),
    portalConfigId: val(process.env.STRIPE_PORTAL_CONFIGURATION_ID),
  },
  email: {
    provider: (emailProviderRaw === "resend" || emailProviderRaw === "mailbox" ? emailProviderRaw : "auto") as "auto" | "resend" | "mailbox",
    resendKey: val(process.env.RESEND_API_KEY),
    resendWebhookSecret: val(process.env.RESEND_WEBHOOK_SECRET),
    from: val(process.env.EMAIL_FROM) ?? "Haven <hello@example.org>",
    replyTo: val(process.env.EMAIL_REPLY_TO),
    redirectTo: val(process.env.EMAIL_REDIRECT_TO),
  },
  ai: {
    provider: (aiProviderRaw === "anthropic" || aiProviderRaw === "gemini" || aiProviderRaw === "none" ? aiProviderRaw : "auto") as
      | "auto"
      | "anthropic"
      | "gemini"
      | "none",
    anthropicKey: val(process.env.ANTHROPIC_API_KEY),
    anthropicModel: val(process.env.ANTHROPIC_MODEL) ?? "claude-opus-5-5",
    gcpProject: val(process.env.GOOGLE_CLOUD_PROJECT),
    gcpLocation: val(process.env.GOOGLE_CLOUD_LOCATION) ?? "global",
    /** Raw JSON or base64. */
    gcpServiceAccountJson: val(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    /** Local only (Application Default Credentials file). */
    gcpAdcFile: val(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    geminiTextModel: val(process.env.GEMINI_TEXT_MODEL) ?? "gemini-3.8-flash",
    geminiImageModel: val(process.env.GEMINI_IMAGE_MODEL) ?? "gemini-3.1-flash-image",
    images: (val(process.env.AI_IMAGES) ?? "on").toLowerCase() !== "off",
  },
  zoom: {
    accountId: val(process.env.ZOOM_ACCOUNT_ID),
    clientId: val(process.env.ZOOM_CLIENT_ID),
    clientSecret: val(process.env.ZOOM_CLIENT_SECRET),
    defaultHost: val(process.env.ZOOM_DEFAULT_HOST) ?? "me",
  },
  turnstile: {
    siteKey: val(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    secret: val(process.env.TURNSTILE_SECRET_KEY),
  },
  analytics: {
    mode: ((val(process.env.NEXT_PUBLIC_ANALYTICS) ?? "vercel").toLowerCase() === "off" ? "off" : "vercel") as "vercel" | "off",
    events: (val(process.env.NEXT_PUBLIC_ANALYTICS_EVENTS) ?? "off").toLowerCase() === "on",
  },
} as const;

let serviceAccountCache: FirebaseServiceAccount | null | undefined;

/**
 * Firebase Admin credentials from FIREBASE_SERVICE_ACCOUNT_JSON (one line, or base64 of it), or the
 * undocumented FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY fallback (D34).
 * Returns null when absent or unreadable (the reason is logged once, never the value).
 */
export function firebaseServiceAccount(): FirebaseServiceAccount | null {
  if (serviceAccountCache !== undefined) return serviceAccountCache;
  serviceAccountCache = null;
  const raw = env.firebase.serviceAccountJson;
  if (raw) {
    try {
      const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const json = JSON.parse(text) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
      if (typeof json.project_id === "string" && typeof json.client_email === "string" && typeof json.private_key === "string") {
        serviceAccountCache = {
          projectId: json.project_id,
          clientEmail: json.client_email,
          privateKey: json.private_key.replace(/\\n/g, "\n"),
        };
        return serviceAccountCache;
      }
      warn("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key.");
    } catch {
      warn("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON (it must be on one line).");
    }
    return serviceAccountCache;
  }
  const projectId = val(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = val(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = val(process.env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    serviceAccountCache = { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
  }
  return serviceAccountCache;
}

let backendCache: Backend | undefined;

/**
 * Which data backend this process uses (PLAN §4.3):
 * 1. HAVEN_BACKEND=firestore|local forces a mode. `local` on Vercel throws (read-only filesystem).
 *    `firestore` without credentials logs the problem and resolves to `unavailable`, so public pages
 *    still render from seeds instead of crashing.
 * 2. Firebase server credentials present → `firestore`.
 * 3. Otherwise `local` off Vercel, `unavailable` on Vercel.
 */
export function resolveBackend(): Backend {
  if (backendCache) return backendCache;
  const forced = env.backendOverride;
  if (forced === "local") {
    if (env.onVercel) throw new Error("HAVEN_BACKEND=local cannot run on Vercel: its filesystem is read-only. Remove HAVEN_BACKEND.");
    return (backendCache = "local");
  }
  const hasCredentials = firebaseServiceAccount() !== null;
  if (forced === "firestore") {
    if (!hasCredentials) {
      console.error("[haven] HAVEN_BACKEND=firestore but Firestore credentials are missing (FIREBASE_SERVICE_ACCOUNT_JSON). Data is unavailable; public pages use the built-in content.");
      return (backendCache = "unavailable");
    }
    return (backendCache = "firestore");
  }
  if (hasCredentials) return (backendCache = "firestore");
  return (backendCache = env.onVercel ? "unavailable" : "local");
}

export type Features = {
  readonly backend: Backend;
  /** backend === "local": the sand practice ribbon, Outbox and practice sign-in chips. */
  readonly practiceMode: boolean;
  /** backend !== "unavailable". */
  readonly canWrite: boolean;
  readonly stripe: boolean;
  readonly stripeLive: boolean;
  readonly stripeWebhook: boolean;
  readonly anthropic: boolean;
  readonly gemini: boolean;
  readonly ai: boolean;
  readonly zoomApi: boolean;
  readonly turnstile: boolean;
};

const anthropic = Boolean(env.ai.anthropicKey);
const gemini = Boolean(env.ai.gcpProject && (env.ai.gcpServiceAccountJson || env.ai.gcpAdcFile));

export const features: Features = {
  get backend() {
    return resolveBackend();
  },
  get practiceMode() {
    return resolveBackend() === "local";
  },
  get canWrite() {
    return resolveBackend() !== "unavailable";
  },
  stripe: Boolean(env.stripe.secretKey),
  stripeLive: /^(sk|rk)_live_/.test(env.stripe.secretKey ?? ""),
  stripeWebhook: Boolean(env.stripe.webhookSecret),
  anthropic,
  gemini,
  ai: env.ai.provider !== "none" && (anthropic || gemini),
  zoomApi: Boolean(env.zoom.accountId && env.zoom.clientId && env.zoom.clientSecret),
  turnstile: Boolean(env.turnstile.siteKey && env.turnstile.secret),
};

const warnedSecrets = new Set<string>();

/**
 * The token-signing (`hmac`) or email-lookup (`lookup`) secret. Uses HAVEN_HMAC_SECRET /
 * HAVEN_LOOKUP_SECRET when set. Off Vercel, a missing secret falls back to a development-only value
 * derived on this computer (with a one-time warning); on Vercel it throws, so callers degrade
 * (token links switched off) rather than signing with a guessable secret.
 */
export function devSecret(name: "hmac" | "lookup"): string {
  const configured = name === "hmac" ? env.hmacSecret : env.lookupSecret;
  if (configured) return configured;
  const variable = name === "hmac" ? "HAVEN_HMAC_SECRET" : "HAVEN_LOOKUP_SECRET";
  if (env.onVercel) throw new Error(`${variable} is not set.`);
  if (!warnedSecrets.has(name)) {
    warnedSecrets.add(name);
    warn(`${variable} is not set; using a development-only secret derived on this computer.`);
  }
  return createHash("sha256").update(`haven-dev-${name}:${process.cwd()}`).digest("base64url");
}
