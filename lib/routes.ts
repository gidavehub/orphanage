// Every internal href is built here (PLAN D25; public-pages §1.1 is the binding route list).
// Stored CTAs point at RouteKeys, which resolve to the final page URLs. The `one_time` ↔ `once`
// frequency mapping happens here, at the URL boundary only (D64).

import type { Area } from "@/lib/admin/access";
import {
  CURRENCIES,
  type ContactCategory,
  type Currency,
  type Frequency,
  FREQUENCIES,
  type PartnerKind,
  type PartnershipType,
  type ProgrammeSlug,
  type ResourceCategory,
  type SupportFormCategory,
  type VolunteerInterest,
} from "@/lib/model/enums";
import { SPONSOR_RE, normaliseRef } from "@/lib/model/refs";
import { safeNextPath } from "@/lib/model/session";

export { PROGRAMME_SLUG, programmeIdOfSlug } from "@/lib/model/enums";

/** Cause slugs that collide with static donate routes or have special meaning (D11). */
export const RESERVED_CAUSE_SLUGS: readonly string[] = ["thank-you", "general", "in-kind", "api", "manage", "receipt"];

export function isReservedCauseSlug(slug: string): boolean {
  return RESERVED_CAUSE_SLUGS.includes(slug);
}

/** The general cause lives at /donate itself. */
export const GENERAL_CAUSE_SLUG = "general";

/** Content CTAs (`Cta.to`) and navigation keys. */
export type RouteKey =
  | "top"
  | "about"
  | "programmes"
  | "involved"
  | "impact"
  | "donate"
  | "getSupport"
  | "support"
  | "report"
  | "stories"
  | "tellStory"
  | "faq"
  | "news"
  | "contact"
  | "volunteer"
  | "partner"
  | "sponsor"
  | "projects"
  | "resources"
  | "requestReport"
  | "policies";

export const ROUTE_KEYS: readonly RouteKey[] = [
  "top",
  "about",
  "programmes",
  "involved",
  "impact",
  "donate",
  "getSupport",
  "support",
  "report",
  "stories",
  "tellStory",
  "faq",
  "news",
  "contact",
  "volunteer",
  "partner",
  "sponsor",
  "projects",
  "resources",
  "requestReport",
  "policies",
];

export function isRouteKey(v: unknown): v is RouteKey {
  return typeof v === "string" && (ROUTE_KEYS as readonly string[]).includes(v);
}

const ROUTE_HREF: Record<RouteKey, string> = {
  top: "/",
  about: "/about",
  programmes: "/programmes",
  involved: "/get-involved",
  impact: "/impact",
  donate: "/donate",
  getSupport: "/get-support",
  support: "/get-support/request",
  report: "/report-a-concern",
  stories: "/stories",
  tellStory: "/stories/share",
  faq: "/faq",
  news: "/news",
  contact: "/contact",
  volunteer: "/get-involved/volunteer",
  partner: "/get-involved/partner",
  sponsor: "/get-involved/sponsor",
  projects: "/projects",
  resources: "/resources",
  requestReport: "/request-a-report",
  policies: "/policies",
};

/** The final URL for a key. Only "top" becomes the in-page anchor "#top", and only on the home page. */
export function routeHref(key: RouteKey, on?: "home"): string {
  if (key === "top" && on === "home") return "#top";
  return ROUTE_HREF[key];
}

/* ── Frequency at the URL boundary (D64) ───────────────────────────────── */

export type FrequencyUrlToken = "once" | Exclude<Frequency, "one_time">;

export function frequencyToUrl(f: Frequency): FrequencyUrlToken {
  return f === "one_time" ? "once" : f;
}

export function frequencyFromUrl(token: string | null | undefined): Frequency | undefined {
  if (!token) return undefined;
  const t = token.trim().toLowerCase();
  if (t === "once" || t === "one-time" || t === "one_time") return "one_time";
  return (FREQUENCIES as readonly string[]).includes(t) ? (t as Frequency) : undefined;
}

/* ── Builders ──────────────────────────────────────────────────────────── */

type QueryValue = string | number | undefined | null | false;

function withQuery(path: string, q: Record<string, QueryValue>, hash?: string): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === false || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash.replace(/^#/, "")}` : ""}`;
}

function seg(value: string): string {
  return encodeURIComponent(value);
}

export type DonateQuery = { amount?: number; currency?: Currency; frequency?: Frequency; mode?: "in-kind"; ref?: string };

export type PolicySlug = "safeguarding" | "privacy" | "terms";

export const routes = {
  home: "/" as const,
  about: (hash?: string) => withQuery("/about", {}, hash),
  programmes: () => "/programmes",
  programme: (slug: ProgrammeSlug) => `/programmes/${seg(slug)}`,

  /** `/donate` for the general cause; `frequency=once` for one-time gifts. */
  donate: (cause?: string, q: DonateQuery = {}) =>
    withQuery(!cause || cause === GENERAL_CAUSE_SLUG ? "/donate" : `/donate/${seg(cause)}`, {
      amount: q.amount !== undefined && Number.isFinite(q.amount) && q.amount > 0 ? q.amount : undefined,
      currency: q.currency,
      frequency: q.frequency ? frequencyToUrl(q.frequency) : undefined,
      mode: q.mode,
      ref: q.ref,
    }),
  thankYou: (q: { sessionId?: string; ref?: string; t?: string }) =>
    withQuery("/donate/thank-you", { session_id: q.sessionId, ref: q.ref, t: q.t }),
  manage: () => "/donate/manage",
  receipt: (ref: string, t: string) => withQuery(`/donate/receipt/${seg(ref)}`, { t }),

  /** Request Support, optionally prefilled with `?type=`. */
  request: (type?: SupportFormCategory) => withQuery("/get-support/request", { type }),
  getSupport: () => "/get-support",
  concern: () => "/report-a-concern",
  contact: (q: { category?: ContactCategory; programme?: ProgrammeSlug; subject?: string } = {}) =>
    withQuery("/contact", { category: q.category, programme: q.programme, subject: q.subject }),

  resources: (q: { category?: ResourceCategory; access?: "public" | "controlled"; q?: string; page?: number } = {}) =>
    withQuery("/resources", {
      q: q.q?.trim() || undefined,
      category: q.category,
      access: q.access,
      page: q.page && q.page > 1 ? q.page : undefined,
    }),
  resource: (slug: string) => `/resources/${seg(slug)}`,
  /** Download route for public resources (counts the download, then redirects to the file). */
  resourceDownload: (slug: string) => `/api/resources/${seg(slug)}/download`,
  requestReport: (slug?: string) => withQuery("/request-a-report", { report: slug }),

  news: (q: { category?: string; page?: number } = {}) =>
    withQuery("/news", { category: q.category, page: q.page && q.page > 1 ? q.page : undefined }),
  post: (slug: string) => `/news/${seg(slug)}`,
  rss: () => "/news/rss.xml",
  projects: () => "/projects",
  project: (slug: string) => `/projects/${seg(slug)}`,
  stories: () => "/stories",
  story: (id: string) => `/stories#s-${seg(id)}`,
  shareStory: () => "/stories/share",
  impact: () => "/impact",

  involved: () => "/get-involved",
  volunteer: (q: { interest?: VolunteerInterest } = {}) => withQuery("/get-involved/volunteer", { interest: q.interest }),
  /** `?type=` preselects the partnership type (public-pages §3.18); organisation kinds are accepted too. */
  partner: (q: { programme?: ProgrammeSlug; type?: PartnershipType | PartnerKind } = {}) =>
    withQuery("/get-involved/partner", { programme: q.programme, type: q.type }),
  sponsor: (ref?: string) => withQuery("/get-involved/sponsor", { ref }),

  faq: () => "/faq",
  policies: () => "/policies",
  policy: (slug: PolicySlug) => `/policies/${seg(slug)}`,
  privacyRequest: () => "/privacy/request",
  privacyVerify: (token: string) => withQuery("/privacy/request/verify", { token }),
  search: (q?: string) => withQuery("/search", { q: q?.trim() || undefined }),
  unsubscribe: (token: string) => withQuery("/unsubscribe", { token }),
  newsletterConfirm: (token: string) => withQuery("/newsletter/confirm", { token }),

  admin: {
    home: "/admin" as const,
    /** Sign-in, returning to a safe admin path afterwards. */
    login: (next?: string) => {
      const safe = next ? safeNextPath(next) : "/admin";
      return safe === "/admin" ? "/admin/login" : withQuery("/admin/login", { next: safe });
    },
    /** Short link used in staff emails; redirects to the record's home after a permission check. */
    record: (ref: string) => `/admin/r/${seg(ref)}`,
    place: (area: Area) => (area === "today" ? "/admin" : `/admin/${area}`),
  },
} as const;

/**
 * Reads the shareable donate query (public-pages §4.1). Invalid values are dropped silently, never
 * errors: unknown currency, non-positive amounts, unknown frequency, or a malformed sponsor code.
 */
export function parseDonateQuery(sp: Pick<URLSearchParams, "get">): DonateQuery {
  const out: DonateQuery = {};
  const amountRaw = sp.get("amount");
  if (amountRaw) {
    const amount = Number(amountRaw);
    if (Number.isFinite(amount) && amount > 0 && amount <= 100_000_000) out.amount = Math.round(amount * 100) / 100;
  }
  const currency = sp.get("currency")?.trim().toUpperCase();
  if (currency && (CURRENCIES as readonly string[]).includes(currency)) out.currency = currency as Currency;
  const frequency = frequencyFromUrl(sp.get("frequency"));
  if (frequency) out.frequency = frequency;
  const mode = sp.get("mode")?.trim().toLowerCase();
  if (mode === "in-kind" || mode === "in_kind" || mode === "inkind") out.mode = "in-kind";
  const ref = sp.get("ref");
  if (ref) {
    const normal = normaliseRef(ref);
    if (normal && SPONSOR_RE.test(normal)) out.ref = normal;
  }
  return out;
}
