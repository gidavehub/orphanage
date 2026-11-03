import "server-only";

// Settings › Connections › Card payments (owner, 2026-11-03): super admins paste Haven's Stripe keys
// here, or send another super admin a secure link to paste them. The keys are kept by Haven
// (settings/stripe, secrets sealed: lib/server/payments/keys.ts) and are what every Stripe call and
// the webhook use from then on.
// - Saving checks the secret key with Stripe (which account, test or live), checks the publishable
//   key is from the same mode, and either sets up the webhook in Stripe ("Set it up for me": an
//   endpoint at /api/stripe/webhook for the events Haven handles, its secret kept) or takes a pasted
//   signing secret. Blank boxes keep what's saved. Values are never shown again: only the last four
//   characters. Every change is audited and emailed to every super admin.
// - Changing keys redirects donations, so it needs settings.manage (super admins) and a sign-in in
//   the last 30 minutes, here and through the link alike.
// - The secure link (/admin/keys/<token>) is for one named super admin, works for 7 days and as
//   often as they like, and can be cancelled. The token is never stored: the record lives at
//   stripeKeyLinks/{sha256(token)}. Opening it still means signing in as that person (password and
//   emailed code), because a bare link that could change the keys would be a way to steal gifts.

import { formatStaffDate } from "@/lib/admin/format";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { CARD_CURRENCIES, type StripeKeysDoc } from "@/lib/model/domain/settings";
import type { StaffProfile } from "@/lib/model/domain/staff";
import type { Currency, Millis, Uid } from "@/lib/model/enums";
import { STEP_UP_MS } from "@/lib/model/session";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { drainAfterResponse, enqueueEmailTx } from "@/lib/server/email/outbox";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { HANDLED_EVENTS } from "@/lib/server/payments/handlers";
import { STRIPE_KEYS_PATH, forgetStripeKeys, modeOf, type StripeMode } from "@/lib/server/payments/keys";
import { stripeClientFor } from "@/lib/server/payments/stripe";
import { randomToken, sha256Hex } from "@/lib/server/security/hmac";
import { sealField, sealingAvailable, tryOpenField } from "@/lib/server/security/seal";
import { absolute } from "@/lib/server/url";

export const LINK_TTL_MS = 7 * 86_400_000;
const LINK_ID_RE = /^[a-f0-9]{64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

const SECRET_RE = /^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/;
const PUBLISHABLE_RE = /^pk_(test|live)_[A-Za-z0-9]{16,}$/;
const WEBHOOK_RE = /^whsec_[A-Za-z0-9+/=]{16,}$/;
const PORTAL_RE = /^bpc_[A-Za-z0-9]{8,}$/;

/** "…4242": what the page shows of a key. */
const tail = (key: string) => key.slice(-4);

/** What people paste often carries spaces, line breaks or quotes. */
const clean = (raw: unknown) => (typeof raw === "string" ? raw.replace(/\s+/g, "").replace(/^["'`]+|["'`]+$/g, "") : "");

/** The webhook address Stripe calls. "Set it up for me" needs it to be public https. */
export function webhookUrl(): string {
  return absolute("/api/stripe/webhook");
}

function webhookCanBeMade(url: string): boolean {
  return /^https:\/\//.test(url) && !/\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/)/.test(url);
}

/* ── What the page shows ───────────────────────────────────────────────── */

export type StripeKeysView = {
  source: "saved" | "env" | "none";
  mode: StripeMode;
  account: { id: string; name: string | null } | null;
  /** The last four characters of each key that's set. */
  hints: { secretKey: string | null; publishableKey: string | null; webhookSecret: string | null };
  /** Set by "Set it up for me" (Haven made the endpoint in Stripe). */
  webhookMadeByHaven: boolean;
  currencies: Currency[];
  portalConfigId: string | null;
  updatedAt: Millis | null;
  updatedByName: string | null;
  /** 0 when nothing is saved: the form sends it back so two people can't overwrite each other. */
  baseUpdatedAt: Millis;
  webhookUrl: string;
  webhookCanBeMade: boolean;
  /** The events the webhook must send (for someone setting it up by hand). */
  events: string[];
  /** HAVEN_DATA_KEY is set (or practice mode): keys can be stored safely. */
  canStore: boolean;
};

function readDoc(): Promise<WithId<StripeKeysDoc> | null> {
  return getStore().get<StripeKeysDoc>(STRIPE_KEYS_PATH);
}

/** The card-payments page for a super admin. */
export async function getStripeKeysView(): Promise<StripeKeysView> {
  await requireStaff("settings.manage");
  return viewOf(await readDoc());
}

function viewOf(doc: StripeKeysDoc | null): StripeKeysView {
  const url = webhookUrl();
  const common = { webhookUrl: url, webhookCanBeMade: webhookCanBeMade(url), events: [...HANDLED_EVENTS], canStore: sealingAvailable() };
  if (doc?.secretKey) {
    return {
      ...common,
      source: "saved",
      mode: doc.mode,
      account: doc.account,
      hints: { secretKey: doc.hints.secretKey, publishableKey: doc.hints.publishableKey, webhookSecret: doc.hints.webhookSecret },
      webhookMadeByHaven: Boolean(doc.webhookEndpointId),
      currencies: doc.currencies,
      portalConfigId: doc.portalConfigId,
      updatedAt: doc.updatedAt,
      updatedByName: doc.updatedBy?.name ?? null,
      baseUpdatedAt: doc.updatedAt,
    };
  }
  const s = env.stripe;
  return {
    ...common,
    source: s.secretKey ? "env" : "none",
    mode: modeOf(s.secretKey),
    account: null,
    hints: { secretKey: s.secretKey ? tail(s.secretKey) : null, publishableKey: s.publishableKey ? tail(s.publishableKey) : null, webhookSecret: s.webhookSecret ? tail(s.webhookSecret) : null },
    webhookMadeByHaven: false,
    currencies: s.currencies.filter((c) => (CARD_CURRENCIES as readonly Currency[]).includes(c)),
    portalConfigId: s.portalConfigId,
    updatedAt: null,
    updatedByName: null,
    baseUpdatedAt: 0,
  };
}

/* ── Talking to Stripe ─────────────────────────────────────────────────── */

type Checked = { ok: true; account: { id: string; name: string | null } | null } | { ok: false; kind: "validation" | "unavailable"; message: string };

const errType = (err: unknown) => (err && typeof err === "object" ? String((err as { type?: unknown }).type ?? "") : "");

/** Asks Stripe whose key this is. A restricted key that may not read the account still passes. */
async function checkSecretKey(key: string): Promise<Checked> {
  try {
    const a = await stripeClientFor(key).accounts.retrieveCurrent();
    return { ok: true, account: { id: a.id, name: a.settings?.dashboard?.display_name || a.business_profile?.name || null } };
  } catch (err) {
    const type = errType(err);
    if (type === "StripeAuthenticationError") return { ok: false, kind: "validation", message: "Stripe didn't accept this secret key. Copy it again from Stripe › Developers › API keys." };
    if (type === "StripePermissionError") return { ok: true, account: null };
    log.warn("stripe.keys.check_failed", { type });
    return { ok: false, kind: "unavailable", message: "Haven couldn't reach Stripe just now. Nothing was saved. Please try again in a minute." };
  }
}

type Made = { ok: true; id: string; secret: string } | { ok: false; message: string };

/**
 * "Set it up for me": a webhook endpoint at Haven's address for the events Haven handles. Made first,
 * then any older one Haven made for the same address is removed (so a failure never leaves none).
 * An endpoint someone else made at this address is left alone and its secret asked for instead.
 */
async function makeWebhook(key: string, url: string, previousId: string | null): Promise<Made> {
  const stripe = stripeClientFor(key);
  try {
    const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === url);
    const ours = (e: (typeof existing)[number]) => e.metadata?.haven === "1" || e.id === previousId;
    if (existing.some((e) => !ours(e))) {
      return { ok: false, message: "Stripe already has a webhook for this address that Haven didn't make. Paste its signing secret instead, or delete it in Stripe and try again." };
    }
    const made = await stripe.webhookEndpoints.create({ url, enabled_events: [...HANDLED_EVENTS], description: "Haven: card gifts, renewals and refunds", metadata: { haven: "1" } });
    if (!made.secret) return { ok: false, message: "Stripe made the webhook but didn't send its secret. Paste it from Stripe › Developers › Webhooks." };
    for (const e of existing) await stripe.webhookEndpoints.del(e.id).catch((err: unknown) => log.warn("stripe.keys.old_webhook_left", { type: errType(err) }));
    return { ok: true, id: made.id, secret: made.secret };
  } catch (err) {
    const type = errType(err);
    log.warn("stripe.keys.webhook_failed", { type });
    if (type === "StripePermissionError") return { ok: false, message: "This key isn't allowed to manage webhooks. Paste the signing secret instead." };
    return { ok: false, message: "Haven couldn't set up the webhook in Stripe just now. Try again, or paste the signing secret instead." };
  }
}

/* ── Saving ────────────────────────────────────────────────────────────── */

export type StripeKeysInput = {
  /** Blank keeps the saved key. */
  secretKey?: unknown;
  /** Blank keeps the saved key. */
  publishableKey?: unknown;
  /** "auto" = set it up for me; "paste" = webhookSecret; "keep" = leave the saved one (or none). */
  webhook?: unknown;
  webhookSecret?: unknown;
  currencies?: unknown;
  portalConfigId?: unknown;
  baseUpdatedAt?: unknown;
};

export type StripeKeysSaved = { mode: "test" | "live"; account: string | null; webhook: "made" | "pasted" | "kept" | "none" };

type SaveOpts = { via: "settings" | "link"; linkId?: string; /** Selftests: never call Stripe. */ offline?: boolean };

class Stale extends Error {}

const MODE_LABEL = { test: "Test", live: "Live" } as const;

/** Checks and saves the keys. The caller has already required settings.manage. */
export async function saveStripeKeys(v: Viewer, input: StripeKeysInput, opts: SaveOpts): Promise<ActionResult<StripeKeysSaved>> {
  if (!v.perms.has("settings.manage")) return actionError({ kind: "not_allowed", message: "Only super admins can change the Stripe keys." });
  if (Date.now() - v.authTime > STEP_UP_MS) return actionError({ kind: "forbidden", message: "Please confirm it's you first.", paths: ["step-up"] });
  if (!sealingAvailable()) return actionError({ kind: "unavailable", message: "Haven can't protect the keys yet: HAVEN_DATA_KEY isn't set on the server. Nothing was saved." });

  const saved = await readDoc();
  const base = typeof input.baseUpdatedAt === "number" ? input.baseUpdatedAt : 0;
  if ((saved?.updatedAt ?? 0) !== base) {
    return actionError({ kind: "conflict", message: "Someone else saved the Stripe keys while you were here. Look at what they saved first.", current: { version: 0, updatedBy: saved?.updatedBy?.name ?? "", updatedAt: saved?.updatedAt ?? 0 } });
  }

  const f: Record<string, string> = {};
  const secretIn = clean(input.secretKey);
  const publishableIn = clean(input.publishableKey);
  const webhookChoice = input.webhook === "auto" || input.webhook === "paste" ? input.webhook : "keep";
  const webhookIn = clean(input.webhookSecret);
  const portalIn = clean(input.portalConfigId);
  const wanted = Array.isArray(input.currencies) ? input.currencies : [];
  const currencies = CARD_CURRENCIES.filter((c) => wanted.includes(c));

  if (secretIn) {
    if (/^pk_/.test(secretIn)) f.secretKey = "That's the publishable key. The secret key starts with sk_live_ or sk_test_.";
    else if (/^whsec_/.test(secretIn)) f.secretKey = "That's the webhook signing secret. The secret key starts with sk_live_ or sk_test_.";
    else if (!SECRET_RE.test(secretIn)) f.secretKey = "This doesn't look like a Stripe secret key. It starts with sk_live_ or sk_test_.";
  } else if (!saved?.secretKey) f.secretKey = "Paste the secret key. It starts with sk_live_ or sk_test_.";

  const savedSecret = saved?.secretKey ? tryOpenField<string>(STRIPE_KEYS_PATH, "secretKey", saved.secretKey) : null;
  if (!secretIn && saved?.secretKey && !savedSecret) f.secretKey = "The saved key can't be opened on this server. Paste the secret key again.";
  const secretKey = secretIn || savedSecret || "";
  const mode = modeOf(secretKey) === "live" ? "live" : "test";

  if (publishableIn) {
    if (/^(sk|rk)_/.test(publishableIn)) f.publishableKey = "That's a secret key. The publishable key starts with pk_live_ or pk_test_.";
    else if (!PUBLISHABLE_RE.test(publishableIn)) f.publishableKey = "This doesn't look like a publishable key. It starts with pk_live_ or pk_test_.";
  } else if (!saved?.publishableKey) f.publishableKey = "Paste the publishable key. It starts with pk_live_ or pk_test_.";
  const publishableKey = publishableIn || saved?.publishableKey || "";
  if (!f.secretKey && !f.publishableKey && publishableKey && secretKey && !publishableKey.startsWith(`pk_${mode}_`)) {
    f.publishableKey = `This is a ${mode === "live" ? "test" : "live"} key but the secret key is ${mode}. Use both keys from the same mode in Stripe.`;
  }

  if (webhookChoice === "paste") {
    if (!webhookIn) f.webhookSecret = "Paste the webhook signing secret. It starts with whsec_.";
    else if (!WEBHOOK_RE.test(webhookIn)) f.webhookSecret = "This doesn't look like a webhook signing secret. It starts with whsec_.";
  }
  const url = webhookUrl();
  if (webhookChoice === "auto" && (opts.offline || !webhookCanBeMade(url))) f.webhook = "Haven can set up the webhook only on its public https address. Paste the signing secret instead.";
  if (!currencies.length) f.currencies = "Choose at least one currency the Stripe account can take.";
  if (portalIn && !PORTAL_RE.test(portalIn)) f.portalConfigId = "This doesn't look like a portal configuration id. It starts with bpc_, or leave it blank.";
  if (Object.keys(f).length) return actionError({ kind: "validation", fields: f });

  // A new secret key is checked with Stripe before anything is kept.
  let account = saved?.account ?? null;
  if (secretIn && secretIn !== savedSecret) {
    const checked: Checked = opts.offline ? { ok: true, account: null } : await checkSecretKey(secretIn);
    if (!checked.ok) return checked.kind === "validation" ? actionError({ kind: "validation", fields: { secretKey: checked.message } }) : actionError({ kind: "unavailable", message: checked.message });
    account = checked.account;
  }
  const moved = Boolean(saved?.secretKey) && (saved!.mode !== mode || (saved!.account?.id ?? null) !== (account?.id ?? null));
  if (webhookChoice === "keep" && saved?.webhookSecret && moved) {
    return actionError({ kind: "validation", fields: { webhook: "These keys are for a different Stripe account or mode, so the saved webhook won't work with them. Choose “Set it up for me” or paste the new signing secret." } });
  }

  let webhookSecret: string | null = null;
  let webhookEndpointId: string | null = moved ? null : (saved?.webhookEndpointId ?? null);
  let webhook: StripeKeysSaved["webhook"] = "none";
  if (webhookChoice === "auto") {
    const made = await makeWebhook(secretKey, url, moved ? null : (saved?.webhookEndpointId ?? null));
    if (!made.ok) return actionError({ kind: "validation", fields: { webhook: made.message } });
    webhookSecret = made.secret;
    webhookEndpointId = made.id;
    webhook = "made";
  } else if (webhookChoice === "paste") {
    webhookSecret = webhookIn;
    webhookEndpointId = null;
    webhook = "pasted";
  }

  const now = Date.now();
  const doc: StripeKeysDoc = {
    secretKey: sealField(STRIPE_KEYS_PATH, "secretKey", secretKey),
    publishableKey,
    webhookSecret: webhookSecret ? sealField(STRIPE_KEYS_PATH, "webhookSecret", webhookSecret) : webhookChoice === "keep" ? (saved?.webhookSecret ?? null) : null,
    webhookEndpointId,
    mode,
    currencies,
    portalConfigId: portalIn || null,
    account,
    hints: { secretKey: tail(secretKey), publishableKey: tail(publishableKey), webhookSecret: webhookSecret ? tail(webhookSecret) : webhookChoice === "keep" ? (saved?.hints.webhookSecret ?? null) : null },
    updatedAt: now,
    updatedBy: { uid: v.uid, name: v.displayName },
    via: opts.via,
  };
  if (webhook === "none" && doc.webhookSecret) webhook = "kept";

  const changed = [
    secretIn && secretIn !== savedSecret ? "secret key" : null,
    publishableIn && publishableIn !== saved?.publishableKey ? "publishable key" : null,
    webhook === "made" || webhook === "pasted" ? "webhook" : null,
    saved && saved.currencies.join() !== currencies.join() ? "currencies" : null,
    saved && (saved.portalConfigId ?? "") !== (doc.portalConfigId ?? "") ? "portal setting" : null,
  ].filter((x): x is string => Boolean(x));
  const what = saved?.secretKey ? (changed.length ? changed.join(", ") : "saved again, nothing new") : "keys added";

  try {
    const admins = await superAdminUids();
    await getStore().runTransaction(async (tx) => {
      const cur = await tx.get<StripeKeysDoc>(STRIPE_KEYS_PATH);
      const link = opts.linkId ? await tx.get<StripeKeyLink>(docPath("stripeKeyLinks", opts.linkId)) : null;
      if ((cur?.updatedAt ?? 0) !== base) throw new Stale();
      tx.set(STRIPE_KEYS_PATH, doc);
      if (link) tx.update(docPath("stripeKeyLinks", opts.linkId!), { savedAt: now, saves: (link.saves ?? 0) + 1 });
      auditTx(tx, {
        actor: actorOf(v),
        action: "settings.stripe_keys",
        area: "settings",
        summary: `${v.displayName} ${saved?.secretKey ? "changed" : "added"} the Stripe keys (${MODE_LABEL[mode].toLowerCase()} mode${opts.via === "link" ? ", through a secure link" : ""})`,
        feed: true,
        sensitive: true,
        targetPath: STRIPE_KEYS_PATH,
        changes: changed.map((field) => ({ field, redacted: true as const })),
      });
      await enqueueEmailTx(tx, {
        template: "stripe_keys_changed",
        toStaffUids: admins,
        vars: {
          changedBy: v.displayName,
          change: what,
          account: account ? (account.name ? `${account.name} (${account.id})` : account.id) : "Not shown for this key",
          mode: mode === "live" ? "Live: real cards" : "Test: test cards only",
          link: absolute("/admin/settings/connections/stripe"),
        },
        dedupeKey: `stripekeys~${now.toString(36)}`,
      });
    });
  } catch (err) {
    if (err instanceof Stale) return actionError({ kind: "conflict", message: "Someone else saved the Stripe keys while you were here. Look at what they saved first.", current: { version: 0, updatedBy: "", updatedAt: 0 } });
    log.error("stripe.keys.save_failed", { err });
    return actionError({ kind: "unavailable", message: "The keys didn't save. Please try again." });
  }
  forgetStripeKeys();
  drainAfterResponse();
  return actionOk({ mode, account: account?.name ?? account?.id ?? null, webhook });
}

/** Removes the saved keys: card payments fall back to the server's STRIPE_* variables, or stop. */
export async function removeStripeKeys(v: Viewer): Promise<ActionResult<{ at: Millis }>> {
  if (!v.perms.has("settings.manage")) return actionError({ kind: "not_allowed", message: "Only super admins can change the Stripe keys." });
  if (Date.now() - v.authTime > STEP_UP_MS) return actionError({ kind: "forbidden", message: "Please confirm it's you first.", paths: ["step-up"] });
  const saved = await readDoc();
  if (!saved?.secretKey) return actionOk({ at: Date.now() });
  // The webhook Haven made goes too, so Stripe stops calling an address that can't check it.
  const secret = tryOpenField<string>(STRIPE_KEYS_PATH, "secretKey", saved.secretKey);
  if (secret && saved.webhookEndpointId) {
    await stripeClientFor(secret)
      .webhookEndpoints.del(saved.webhookEndpointId)
      .catch((err: unknown) => log.warn("stripe.keys.webhook_left", { type: errType(err) }));
  }
  const now = Date.now();
  try {
    const admins = await superAdminUids();
    await getStore().runTransaction(async (tx) => {
      tx.delete(STRIPE_KEYS_PATH);
      auditTx(tx, { actor: actorOf(v), action: "settings.stripe_keys_remove", area: "settings", summary: `${v.displayName} removed the saved Stripe keys`, feed: true, sensitive: true, targetPath: STRIPE_KEYS_PATH });
      await enqueueEmailTx(tx, {
        template: "stripe_keys_changed",
        toStaffUids: admins,
        vars: { changedBy: v.displayName, change: "saved keys removed", account: saved.account?.name ?? saved.account?.id ?? "", mode: env.stripe.secretKey ? "Back to the server settings" : "Card payments are off", link: absolute("/admin/settings/connections/stripe") },
        dedupeKey: `stripekeys~${now.toString(36)}`,
      });
    });
  } catch (err) {
    log.error("stripe.keys.remove_failed", { err });
    return actionError({ kind: "unavailable", message: "The keys weren't removed. Please try again." });
  }
  forgetStripeKeys();
  drainAfterResponse();
  return actionOk({ at: now });
}

/* ── Secure links ──────────────────────────────────────────────────────── */

/** stripeKeyLinks/{sha256(token)}. */
export type StripeKeyLink = {
  recipientUid: Uid;
  recipientName: string;
  sentByUid: Uid;
  sentByName: string;
  createdAt: Millis;
  expiresAt: Millis;
  revokedAt: Millis | null;
  opens: number;
  lastOpenedAt: Millis | null;
  saves: number;
  savedAt: Millis | null;
  /** Kept a month after it stops working, then cleaned up. */
  expireAt: Millis;
};

export type KeyRecipientDTO = { uid: Uid; name: string; email: string };
export type KeyLinkDTO = { id: string; recipientName: string; sentByName: string; createdAt: Millis; expiresAt: Millis; opens: number; lastOpenedAt: Millis | null; savedAt: Millis | null };

async function activeStaff(): Promise<Array<WithId<StaffProfile>>> {
  const page = await getStore().list<StaffProfile>(C.staff, { where: [{ field: "status", op: "==", value: "active" }], orderBy: { field: "displayName", dir: "asc" }, limit: 100 });
  return page.items;
}

async function superAdminUids(): Promise<Uid[]> {
  return (await activeStaff()).filter((s) => s.roles.includes("super_admin")).map((s) => s.uid);
}

/** Who a link can go to: every other active super admin. */
export async function listKeyRecipients(): Promise<KeyRecipientDTO[]> {
  const v = await requireStaff("settings.manage");
  return (await activeStaff()).filter((s) => s.roles.includes("super_admin") && s.uid !== v.uid).map((s) => ({ uid: s.uid, name: s.displayName, email: s.email }));
}

/** Links that still work, newest first. */
export async function listKeyLinks(): Promise<KeyLinkDTO[]> {
  await requireStaff("settings.manage");
  const now = Date.now();
  try {
    const page = await getStore().list<StripeKeyLink>(C.stripeKeyLinks, { orderBy: { field: "createdAt", dir: "desc" }, limit: 50 });
    return page.items
      .filter((l) => !l.revokedAt && l.expiresAt > now)
      .map((l) => ({ id: l.id, recipientName: l.recipientName, sentByName: l.sentByName, createdAt: l.createdAt, expiresAt: l.expiresAt, opens: l.opens ?? 0, lastOpenedAt: l.lastOpenedAt ?? null, savedAt: l.savedAt ?? null }));
  } catch (err) {
    log.warn("stripe.keys.links_list_failed", { err });
    return [];
  }
}

/** Emails each chosen super admin their own link. */
export async function sendKeyLinks(v: Viewer, uids: unknown): Promise<ActionResult<{ sent: number }>> {
  if (!v.perms.has("settings.manage")) return actionError({ kind: "not_allowed", message: "Only super admins can send this link." });
  const wanted = new Set(Array.isArray(uids) ? uids.filter((u): u is string => typeof u === "string") : []);
  const staff = (await activeStaff()).filter((s) => s.roles.includes("super_admin") && s.uid !== v.uid && wanted.has(s.uid));
  if (!staff.length) return actionError({ kind: "validation", fields: { recipients: "Choose who should get the link." } });
  const now = Date.now();
  try {
    for (const s of staff) {
      const token = randomToken(32);
      const id = sha256Hex(token);
      const link: StripeKeyLink = {
        recipientUid: s.uid,
        recipientName: s.displayName,
        sentByUid: v.uid,
        sentByName: v.displayName,
        createdAt: now,
        expiresAt: now + LINK_TTL_MS,
        revokedAt: null,
        opens: 0,
        lastOpenedAt: null,
        saves: 0,
        savedAt: null,
        expireAt: now + LINK_TTL_MS + 30 * 86_400_000,
      };
      await getStore().runTransaction(async (tx) => {
        tx.create(docPath("stripeKeyLinks", id), link);
        await enqueueEmailTx(tx, {
          template: "stripe_keys_request",
          toStaffUids: [s.uid],
          vars: { firstName: s.displayName.split(" ")[0] ?? "", askedBy: v.displayName, until: formatStaffDate(link.expiresAt, s.timezone || "UTC", "long"), link: absolute(`/admin/keys/${token}`) },
          dedupeKey: `stripelink~${id.slice(0, 24)}`,
        });
        auditTx(tx, { actor: actorOf(v), action: "settings.stripe_link", area: "settings", summary: `${v.displayName} sent ${s.displayName} a secure link to add the Stripe keys`, feed: true, sensitive: true, targetPath: docPath("stripeKeyLinks", id) });
      });
    }
  } catch (err) {
    log.error("stripe.keys.link_failed", { err });
    return actionError({ kind: "unavailable", message: "The link didn't send. Please try again." });
  }
  drainAfterResponse();
  return actionOk({ sent: staff.length });
}

/** Stops a link working. */
export async function cancelKeyLink(v: Viewer, id: string): Promise<ActionResult<{ id: string }>> {
  if (!v.perms.has("settings.manage")) return actionError({ kind: "not_allowed", message: "Only super admins can cancel this link." });
  if (!LINK_ID_RE.test(id)) return actionError({ kind: "not_allowed", message: "That link doesn't exist." });
  const done = await getStore().runTransaction(async (tx) => {
    const link = await tx.get<StripeKeyLink>(docPath("stripeKeyLinks", id));
    if (!link || link.revokedAt) return false;
    tx.update(docPath("stripeKeyLinks", id), { revokedAt: Date.now() });
    auditTx(tx, { actor: actorOf(v), action: "settings.stripe_link_cancel", area: "settings", summary: `${v.displayName} cancelled ${link.recipientName}'s Stripe keys link`, feed: true, targetPath: docPath("stripeKeyLinks", id) });
    return true;
  });
  return done ? actionOk({ id }) : actionError({ kind: "not_allowed", message: "That link has already stopped working." });
}

/** The link behind a token, while it still works. Never throws. */
export async function peekKeyLink(token: string): Promise<(StripeKeyLink & { id: string }) | null> {
  if (!TOKEN_RE.test(token)) return null;
  const id = sha256Hex(token);
  try {
    const link = await getStore().get<StripeKeyLink>(docPath("stripeKeyLinks", id));
    if (!link || link.revokedAt || link.expiresAt <= Date.now()) return null;
    return { ...link, id };
  } catch (err) {
    log.warn("stripe.keys.link_read_failed", { err });
    return null;
  }
}

/** Counts an open by its own recipient (the senders' list shows it). Never throws. */
export async function noteKeyLinkOpened(link: StripeKeyLink & { id: string }): Promise<void> {
  try {
    await getStore().update(docPath("stripeKeyLinks", link.id), { opens: (link.opens ?? 0) + 1, lastOpenedAt: Date.now() });
  } catch (err) {
    log.warn("stripe.keys.link_open_note_failed", { err });
  }
}
