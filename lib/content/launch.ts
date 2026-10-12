import "server-only";

// The Before-launch checklist (content-model §9 step 13; PLAN D46, D130). Read live, uncached, by the
// super admin's /admin/website/launch screen (which calls requireStaff itself). Every item carries a
// deep link to where it is fixed. Informative: nothing here blocks publishing, except that unverified
// figures stop rendering once `settings.site.figures.hideUnverified` is switched on.

import { CONTACT_SEEDS, DEFAULT_DOCS, PLACEHOLDER_DOC_IDS } from "./defaults";
import { COLLECTION_NAMES, DOC_IDS, type CollectionName, type DocId } from "./ids";
import { loadDoc, loadItems } from "./read";
import { COLLECTIONS, DOCS } from "./registry";
import { DocSchemas, ItemSchemas, type EnvelopedCollection } from "./schema";
import { contentStore } from "./store";
import { readMediaIndexUncached } from "@/lib/media/index";
import { mediaIdsIn } from "./gate";
import { env, firebaseServiceAccount } from "@/lib/server/env";

export type LaunchGroup = "content" | "figures" | "images" | "contact" | "partners" | "policies" | "setup" | "data";

export type LaunchItem = {
  id: string;
  group: LaunchGroup;
  /** One plain sentence ("12 illustrative photos of children are still in use"). */
  title: string;
  /** What to do about it. */
  detail: string;
  /** How many things are still open (0 when done). */
  count: number;
  /** Where to fix it (/admin/…). */
  href: string;
  done: boolean;
  /** "must": fix before launch; "should": strongly recommended. */
  severity: "must" | "should";
  /** Up to 12 examples to show under the line. */
  examples?: string[];
};

const ENVELOPED = COLLECTION_NAMES.filter((c): c is EnvelopedCollection => c !== "media");

function item(i: Omit<LaunchItem, "done"> & { done?: boolean }): LaunchItem {
  return { ...i, done: i.done ?? i.count === 0 };
}

/** Stored docs and items that no longer pass their schema (they render their defaults or are dropped). */
export async function findInvalidContent(): Promise<Array<{ key: string; label: string; issues: string[] }>> {
  const store = contentStore();
  const out: Array<{ key: string; label: string; issues: string[] }> = [];
  for (const id of DOC_IDS) {
    const rec = await store.getDoc(id);
    for (const [which, raw] of [
      ["live", rec?.published],
      ["draft", rec?.draft],
    ] as const) {
      if (!raw || typeof raw !== "object") continue;
      const r = DocSchemas[id].safeParse({ ...(DEFAULT_DOCS[id] as Record<string, unknown>), ...(raw as Record<string, unknown>) });
      if (!r.success) out.push({ key: `${id} (${which})`, label: DOCS[id].label, issues: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
  }
  for (const c of ENVELOPED) {
    if (!(await store.isSeeded(c))) continue;
    for (const rec of await store.listItems(c)) {
      for (const [which, raw] of [
        ["live", rec.published],
        ["draft", rec.draft],
      ] as const) {
        if (raw === null || raw === undefined) continue;
        const r = ItemSchemas[c].safeParse(raw);
        if (!r.success) out.push({ key: `${c}/${rec.id} (${which})`, label: COLLECTIONS[c].label, issues: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
    }
  }
  return out;
}

/** Production environment variables that are not set yet (names only, never values). */
function missingProductionEnv(): string[] {
  const missing: string[] = [];
  if (!env.siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!firebaseServiceAccount()) missing.push("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!env.firebase.webConfig) missing.push("NEXT_PUBLIC_FIREBASE_*");
  if (!env.dataKey.key) missing.push("HAVEN_DATA_KEY");
  if (!env.hmacSecret) missing.push("HAVEN_HMAC_SECRET");
  if (!env.lookupSecret) missing.push("HAVEN_LOOKUP_SECRET");
  if (!env.cronSecret) missing.push("CRON_SECRET");
  if (!env.email.resendKey) missing.push("RESEND_API_KEY");
  if (/example\.org/i.test(env.email.from)) missing.push("EMAIL_FROM");
  return missing;
}

function missingRecommendedEnv(): string[] {
  const missing: string[] = [];
  if (!env.stripe.secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!env.stripe.webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  return missing;
}

/** Every remaining placeholder and setup gap, each with a deep link (D130). */
export async function getLaunchReadiness(): Promise<LaunchItem[]> {
  const store = contentStore();
  const items: LaunchItem[] = [];

  // 1. Placeholder records: singletons still holding // CLIENT copy, and seeded items not yet confirmed.
  const placeholderDocs: DocId[] = [];
  for (const id of DOC_IDS) {
    const rec = await store.getDoc(id);
    if (rec ? rec.placeholder === true : PLACEHOLDER_DOC_IDS.has(id)) placeholderDocs.push(id);
  }
  items.push(
    item({
      id: "placeholder-docs",
      group: "content",
      title: placeholderDocs.length ? `${placeholderDocs.length} pages and sections still hold placeholder words` : "Every page and section has been confirmed",
      detail: "Read each one, change what needs changing, then choose “This is real, approved content”.",
      count: placeholderDocs.length,
      href: "/admin/website/changes",
      severity: "must",
      examples: placeholderDocs.slice(0, 12).map((id) => DOCS[id].label),
    }),
  );
  const loaded = new Map<CollectionName, Awaited<ReturnType<typeof loadItems>>>();
  for (const c of ENVELOPED) loaded.set(c, await loadItems(c, { preview: true }));
  for (const c of ENVELOPED) {
    const placeholders = (loaded.get(c) ?? []).filter((x) => x.placeholder);
    if (placeholders.length === 0) continue;
    items.push(
      item({
        id: `placeholder-${c}`,
        group: "content",
        title: `${placeholders.length} ${COLLECTIONS[c].label.toLowerCase()} are placeholders`,
        detail: "Replace them with real, approved content, or confirm them.",
        count: placeholders.length,
        href: COLLECTIONS[c].managedIn,
        severity: c === "stats" || c === "causes" ? "must" : "should",
        examples: placeholders.slice(0, 12).map((x) => {
          const d = x as unknown as { title?: string; label?: string; name?: string; q?: string };
          return d.title ?? d.label ?? d.name ?? d.q ?? x.id;
        }),
      }),
    );
  }

  // 2. Figures (D46): unverified stats and causes, and the switch that hides unverified figures.
  const site = await loadDoc("settings.site");
  const stats = (loaded.get("stats") ?? []) as unknown as Array<{ id: string; label: string; verification: { status: string }; visibility: string }>;
  const unverifiedStats = stats.filter((s) => s.visibility === "live" && s.verification.status !== "verified");
  items.push(
    item({
      id: "unverified-stats",
      group: "figures",
      title: unverifiedStats.length ? `${unverifiedStats.length} impact figures have not been checked` : "Every impact figure has been checked",
      detail: "A programme officer (or the finance team, for money figures) checks each figure against Haven's records.",
      count: unverifiedStats.length,
      href: "/admin/website/impact",
      severity: "must",
      examples: unverifiedStats.slice(0, 12).map((s) => s.label),
    }),
  );
  const causes = (loaded.get("causes") ?? []) as unknown as Array<{ title: string; verification: { status: string }; visibility: string }>;
  const unverifiedCauses = causes.filter((c) => c.visibility === "live" && c.verification.status !== "verified");
  items.push(
    item({
      id: "unverified-causes",
      group: "figures",
      title: unverifiedCauses.length ? `${unverifiedCauses.length} appeals show illustrative goals and breakdowns` : "Every appeal's figures are confirmed",
      detail: "The finance team confirms each goal and “where the money goes” breakdown.",
      count: unverifiedCauses.length,
      href: "/admin/giving/causes",
      severity: "must",
      examples: unverifiedCauses.slice(0, 12).map((c) => c.title),
    }),
  );
  items.push(
    item({
      id: "hide-unverified",
      group: "figures",
      title: site.figures.hideUnverified ? "Unchecked figures are hidden from the website" : "Unchecked figures still show on the website (with an “Illustrative” label)",
      detail: "Switch this on before launch: after that, only checked figures appear anywhere on the site.",
      count: site.figures.hideUnverified ? 0 : 1,
      href: "/admin/website/launch#figures",
      severity: "must",
    }),
  );

  // 3. Illustrative AI images of children still in use (HANDOFF; ToR §15).
  const index = await readMediaIndexUncached();
  const used = new Set<string>();
  for (const id of DOC_IDS) for (const m of mediaIdsIn(await loadDoc(id))) used.add(m);
  for (const c of ENVELOPED) for (const x of loaded.get(c) ?? []) if (x.visibility === "live") for (const m of mediaIdsIn(x)) used.add(m);
  const aiChildren = [...used].filter((id) => {
    const a = index[id];
    return !!a && a.safeguarding.aiGenerated && a.safeguarding.childInImage && a.status === "active";
  });
  items.push(
    item({
      id: "ai-child-images",
      group: "images",
      title: aiChildren.length ? `${aiChildren.length} illustrative photos of children are still in use` : "No illustrative photos of children are in use",
      detail: "Replace each with a real photo that has written consent from a parent or guardian, or keep it labelled as illustrative.",
      count: aiChildren.length,
      href: "/admin/media?filter=illustrative",
      severity: "should",
      examples: aiChildren.slice(0, 12),
    }),
  );

  // 4. Contact details still equal to the seeds.
  const contact = await loadDoc("settings.contact");
  const stale: string[] = [];
  if (contact.phone === CONTACT_SEEDS.phone) stale.push("Phone number");
  if (contact.email === CONTACT_SEEDS.email) stale.push("Email address");
  const placeholderSocials = contact.socials.filter((s) => s.show && s.href === CONTACT_SEEDS.socialHref);
  if (placeholderSocials.length) stale.push(`${placeholderSocials.length} social links`);
  items.push(
    item({
      id: "contact-seeds",
      group: "contact",
      title: stale.length ? "Some contact details are still placeholders" : "Contact details are real",
      detail: "Add the real phone number, email address, office addresses and social links (or hide the links you don't use).",
      count: stale.length,
      href: "/admin/website/key-info",
      severity: "must",
      examples: stale,
    }),
  );

  // 5. Partners without recorded permission.
  const partners = (loaded.get("partners") ?? []) as unknown as Array<{ name: string; permission: { status: string }; visibility: string }>;
  const noPermission = partners.filter((p) => p.visibility === "live" && p.permission.status !== "recorded");
  items.push(
    item({
      id: "partner-permission",
      group: "partners",
      title: noPermission.length ? `${noPermission.length} partner logos have no recorded permission` : "Every partner logo has permission",
      detail: "Record each partner's written permission, or hide their logo.",
      count: noPermission.length,
      href: COLLECTIONS.partners.managedIn,
      severity: "must",
      examples: noPermission.slice(0, 12).map((p) => p.name),
    }),
  );

  // 6. Policies without a professional review (ToR §15).
  const policies = (loaded.get("policies") ?? []) as unknown as Array<{ title: string; lastReview?: { reviewer: string } }>;
  const unreviewed = policies.filter((p) => p.lastReview?.reviewer !== "professional");
  items.push(
    item({
      id: "policy-review",
      group: "policies",
      title: unreviewed.length ? `${unreviewed.length} policies are waiting for a professional review` : "Every policy has had a professional review",
      detail: "Ask a qualified professional to review each policy, then record the review.",
      count: unreviewed.length,
      href: COLLECTIONS.policies.managedIn,
      severity: "must",
      examples: unreviewed.map((p) => p.title),
    }),
  );

  // 7. Production settings (names only).
  const missing = missingProductionEnv();
  items.push(
    item({
      id: "production-env",
      group: "setup",
      title: missing.length ? `${missing.length} production settings are missing` : "Production settings are in place",
      detail: "Your developer adds these in the hosting dashboard. Values are never shown here.",
      count: missing.length,
      href: "/admin/settings/connections",
      severity: "must",
      examples: missing,
    }),
  );
  const recommended = missingRecommendedEnv();
  items.push(
    item({
      id: "recommended-env",
      group: "setup",
      title: recommended.length ? "Online card payments are not connected yet" : "Online card payments are connected",
      detail: "Without Stripe keys, every gift is a pledge and the team emails payment details.",
      count: recommended.length,
      href: "/admin/settings/connections",
      severity: "should",
      examples: recommended,
    }),
  );

  // 8. Stored content that no longer passes its schema.
  const invalid = await findInvalidContent();
  items.push(
    item({
      id: "invalid-content",
      group: "data",
      title: invalid.length ? `${invalid.length} saved items need attention` : "All saved content is valid",
      detail: "These no longer fit the design's limits, so the website shows their previous or default version. Open each one and save it again.",
      count: invalid.length,
      href: "/admin/website/changes",
      severity: "should",
      examples: invalid.slice(0, 12).map((x) => `${x.label}: ${x.issues[0] ?? ""}`),
    }),
  );

  return items;
}
