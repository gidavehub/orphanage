import "server-only";

// Selftest suite "stripekeys" (owner, 2026-11-03): the Stripe keys kept in settings/stripe, offline
// (no Stripe calls). Covers: the server settings until keys are saved; a recent sign-in required;
// keys pasted in the wrong box, mixed modes and bad secrets refused; saved keys sealed and shown
// only as their last four characters; what Stripe calls then use; blank boxes keeping what's saved;
// two people saving at once; a new mode refusing the old webhook; the alert to super admins; the
// secure links (working, cancelled, expired, malformed); removing the keys. settings/stripe is put
// back as it was afterwards, and the links and alerts this run made are deleted.

import type { StripeKeysDoc } from "@/lib/model/domain/settings";
import type { OutboxEmail } from "@/lib/model/domain/system";
import { permsFor } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { cancelKeyLink, peekKeyLink, removeStripeKeys, saveStripeKeys, type StripeKeyLink } from "@/lib/server/dal/stripeKeys";
import { env } from "@/lib/server/env";
import { forgetStripeKeys, STRIPE_KEYS_PATH, stripeKeys } from "@/lib/server/payments/keys";
import { randomToken, sha256Hex } from "@/lib/server/security/hmac";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

// Made-up keys in Stripe's shapes, joined at run time so secret scanners don't take them for real ones.
const fake = (...parts: string[]) => parts.join("_");
const SK = fake("sk", "test", "selftest0000000000000000Abcd");
const SK_LIVE = fake("sk", "live", "selftest0000000000000000Wxyz");
const PK = fake("pk", "test", "selftest0000000000000000Efgh");
const PK_LIVE = fake("pk", "live", "selftest0000000000000000Mnop");
const WH = fake("whsec", "selftest00000000000000000Ijkl");

function admin(authTime = Date.now()): Viewer {
  return {
    uid: "selftest-keys-admin",
    displayName: "Selftest Admin",
    email: "selftest-admin@example.org",
    roles: ["super_admin"],
    perms: permsFor(["super_admin"], []),
    viewerScopes: [],
    programmeScope: "all",
    timezone: "Africa/Banjul",
    textSize: "normal",
    authTime,
    mfa: true,
    backend: "local",
  };
}

const base = async () => (await getStore().get<StripeKeysDoc>(STRIPE_KEYS_PATH))?.updatedAt ?? 0;

export const suite: Suite = {
  name: "stripekeys",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const v = admin();
    const before = await store.get<StripeKeysDoc>(STRIPE_KEYS_PATH);
    const linkIds: string[] = [];
    const startedAt = Date.now();
    const valid = { secretKey: SK, publishableKey: PK, webhook: "paste", webhookSecret: WH, currencies: ["USD", "GBP"] };

    try {
      await store.delete(STRIPE_KEYS_PATH);
      forgetStripeKeys();

      await t.check("with nothing saved, Haven uses the server settings", async () => {
        const k = await stripeKeys();
        return k.source === (env.stripe.secretKey ? "env" : "none") && k.secretKey === env.stripe.secretKey ? true : `source=${k.source}`;
      });

      await t.check("saving needs a sign-in in the last 30 minutes", async () => {
        const r = await saveStripeKeys(admin(Date.now() - 31 * 60_000), { ...valid, baseUpdatedAt: 0 }, { via: "settings", offline: true });
        return !r.ok && r.error.kind === "forbidden" && Boolean(r.error.paths?.includes("step-up"));
      });

      await t.check("only super admins may save", async () => {
        const fo = { ...v, roles: ["finance_officer" as const], perms: permsFor(["finance_officer"], []) };
        const r = await saveStripeKeys(fo, { ...valid, baseUpdatedAt: 0 }, { via: "settings", offline: true });
        return !r.ok && r.error.kind === "not_allowed";
      });

      await t.check("keys in the wrong box, mixed modes and bad secrets are refused", async () => {
        const swapped = await saveStripeKeys(v, { ...valid, secretKey: PK, publishableKey: SK, baseUpdatedAt: 0 }, { via: "settings", offline: true });
        const mixed = await saveStripeKeys(v, { ...valid, secretKey: SK_LIVE, baseUpdatedAt: 0 }, { via: "settings", offline: true });
        const badHook = await saveStripeKeys(v, { ...valid, webhookSecret: "nope", baseUpdatedAt: 0 }, { via: "settings", offline: true });
        const noCurrency = await saveStripeKeys(v, { ...valid, currencies: ["GMD"], baseUpdatedAt: 0 }, { via: "settings", offline: true });
        const f = (r: typeof swapped) => (!r.ok && r.error.kind === "validation" ? r.error.fields : {});
        const ok =
          /publishable key/.test(f(swapped).secretKey ?? "") &&
          /secret key/.test(f(swapped).publishableKey ?? "") &&
          /same mode/.test(f(mixed).publishableKey ?? "") &&
          /whsec_/.test(f(badHook).webhookSecret ?? "") &&
          Boolean(f(noCurrency).currencies);
        return ok ? true : JSON.stringify({ swapped: f(swapped), mixed: f(mixed), badHook: f(badHook), noCurrency: f(noCurrency) });
      });

      await t.check("pasted keys are saved sealed, shown only by their last four characters", async () => {
        const r = await saveStripeKeys(v, { ...valid, secretKey: `  ${SK}\n`, baseUpdatedAt: 0 }, { via: "settings", offline: true });
        const doc = await store.get<StripeKeysDoc>(STRIPE_KEYS_PATH);
        const raw = JSON.stringify(doc);
        return r.ok && r.data.mode === "test" && r.data.webhook === "pasted" && doc?.hints.secretKey === "Abcd" && doc.hints.webhookSecret === "Ijkl" && !raw.includes(SK) && !raw.includes(WH) && doc.currencies.join() === "USD,GBP"
          ? true : `ok=${r.ok} ${r.ok ? "" : JSON.stringify(r.error)} plain=${raw.includes(SK)}`;
      });

      await t.check("Stripe calls and the webhook then use the saved keys", async () => {
        const k = await stripeKeys();
        return k.source === "saved" && k.secretKey === SK && k.webhookSecret === WH && k.publishableKey === PK && k.mode === "test" ? true : `source=${k.source} mode=${k.mode}`;
      });

      await t.check("blank boxes keep what's saved", async () => {
        const r = await saveStripeKeys(v, { secretKey: "", publishableKey: "", webhook: "keep", currencies: ["USD"], baseUpdatedAt: await base() }, { via: "settings", offline: true });
        forgetStripeKeys();
        const k = await stripeKeys();
        return r.ok && r.data.webhook === "kept" && k.secretKey === SK && k.webhookSecret === WH && k.currencies.join() === "USD" ? true : `ok=${r.ok} ${r.ok ? r.data.webhook : JSON.stringify(r.error)}`;
      });

      await t.check("an out-of-date form can't overwrite someone else's save", async () => {
        const r = await saveStripeKeys(v, { ...valid, baseUpdatedAt: 1 }, { via: "settings", offline: true });
        return !r.ok && r.error.kind === "conflict";
      });

      await t.check("keys for another mode won't keep the old webhook", async () => {
        const r = await saveStripeKeys(v, { secretKey: SK_LIVE, publishableKey: PK_LIVE, webhook: "keep", currencies: ["USD"], baseUpdatedAt: await base() }, { via: "settings", offline: true });
        return !r.ok && r.error.kind === "validation" && Boolean(r.error.fields.webhook) ? true : JSON.stringify(r.ok ? r.data : r.error);
      });

      await t.check("every change is emailed to super admins", async () => {
        const page = await store.list<OutboxEmail>(C.emailOutbox, { where: [{ field: "template", op: "==", value: "stripe_keys_changed" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 10 });
        return page.items.some((e) => e.createdAt >= startedAt) ? true : "no stripe_keys_changed email";
      });

      await t.check("a secure link works for its person, and stops when cancelled", async () => {
        const token = randomToken(32);
        const id = sha256Hex(token);
        linkIds.push(id);
        const now = Date.now();
        const link: StripeKeyLink = { recipientUid: "selftest-keys-other", recipientName: "Other Admin", sentByUid: v.uid, sentByName: v.displayName, createdAt: now, expiresAt: now + 3_600_000, revokedAt: null, opens: 0, lastOpenedAt: null, saves: 0, savedAt: null, expireAt: now + 7_200_000 };
        await store.set(docPath("stripeKeyLinks", id), link);
        const open = await peekKeyLink(token);
        const cancelled = await cancelKeyLink(v, id);
        const after = await peekKeyLink(token);
        return open?.recipientUid === "selftest-keys-other" && cancelled.ok && after === null ? true : `open=${Boolean(open)} cancelled=${cancelled.ok} after=${Boolean(after)}`;
      });

      await t.check("expired and made-up links don't work", async () => {
        const token = randomToken(32);
        const id = sha256Hex(token);
        linkIds.push(id);
        const now = Date.now();
        await store.set(docPath("stripeKeyLinks", id), { recipientUid: "x", recipientName: "X", sentByUid: v.uid, sentByName: v.displayName, createdAt: now - 10, expiresAt: now - 1, revokedAt: null, opens: 0, lastOpenedAt: null, saves: 0, savedAt: null, expireAt: now } satisfies StripeKeyLink);
        return (await peekKeyLink(token)) === null && (await peekKeyLink(randomToken(32))) === null && (await peekKeyLink("../settings/stripe")) === null;
      });

      await t.check("removing the saved keys goes back to the server settings", async () => {
        const r = await removeStripeKeys(v);
        const k = await stripeKeys();
        return r.ok && !(await store.get(STRIPE_KEYS_PATH)) && k.source !== "saved" ? true : `ok=${r.ok} source=${k.source}`;
      });
    } finally {
      if (before) await store.set(STRIPE_KEYS_PATH, before);
      else await store.delete(STRIPE_KEYS_PATH).catch(() => undefined);
      forgetStripeKeys();
      for (const id of linkIds) await store.delete(docPath("stripeKeyLinks", id)).catch(() => undefined);
      const mine = await store.list<OutboxEmail>(C.emailOutbox, { where: [{ field: "template", op: "==", value: "stripe_keys_changed" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 20 }).catch(() => ({ items: [] }));
      for (const e of mine.items) if (e.createdAt >= startedAt) await store.delete(`${C.emailOutbox}/${e.id}`).catch(() => undefined);
    }
    return t.cases;
  },
};
