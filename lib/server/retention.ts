import "server-only";

// Retention (data-model §11.4; PLAN D105): how long Haven keeps each kind of record, from Settings ›
// Data (settings/retention, within RETENTION_LIMITS). Run nightly by /api/cron/retention:
//   - auto_delete     → the record and everything under it are deleted;
//   - auto_anonymise  → names, emails, phones and notes are removed, the money record stays;
//   - review          → a person decides: super admins get one note per record (concerns are ALWAYS
//                       review and are never deleted here);
//   - linked / ttl    → handled elsewhere (with their parent record, or by the database's TTL).
// A legal hold always wins. Email bodies are purged after 90 days (the log line stays).
// `dryRun` lists what is due without changing anything.

import { DEFAULT_RETENTION_SETTINGS, type RetentionMode, type RetentionSettings } from "@/lib/model/domain/settings";
import type { OutboxEmail } from "@/lib/model/domain/system";
import type { Millis, RetentionPolicyId } from "@/lib/model/enums";
import { auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { C, settingsPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { notify, superAdminUids } from "@/lib/server/notify";

const DAY = 86_400_000;
const OUTBOX_BODY_DAYS = 90;

export type RetentionScope = { root?: string };
const at = (s: RetentionScope | undefined, p: string) => (s?.root ? `${s.root}/${p}` : p);

export type DueItem = { path: string; policy: RetentionPolicyId; mode: RetentionMode; dueAt: Millis };
export type RetentionReport = { dryRun: boolean; due: DueItem[]; deleted: number; anonymised: number; reviews: number; outboxPurged: number; held: number };

type Rec = {
  id: string;
  status?: string;
  closedAt?: Millis | null;
  cancelledAt?: Millis | null;
  receivedAt?: Millis | null;
  createdAt: Millis;
  lastGiftAt?: Millis | null;
  unsubscribedAt?: Millis | null;
  retention?: { policy?: RetentionPolicyId; legalHold?: boolean; reviewNotifiedAt?: Millis | null };
};

/** Which policy a record falls under, and the moment its clock started (null = not yet). */
type Rule = { collection: keyof typeof C; field: string; pick: (r: Rec) => { policy: RetentionPolicyId; from: Millis } | null };

const RULES: Rule[] = [
  { collection: "supportRequests", field: "closedAt", pick: (r) => (r.closedAt ? { policy: r.retention?.policy === "support.supported" ? "support.supported" : "support.unsupported", from: r.closedAt } : null) },
  { collection: "safeguardingConcerns", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "concern", from: r.closedAt } : null) },
  { collection: "volunteerApplications", field: "closedAt", pick: (r) => (r.closedAt ? { policy: r.status === "declined" ? "volunteer.declined" : "volunteer.former", from: r.closedAt } : null) },
  { collection: "partnershipEnquiries", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "partnership", from: r.closedAt } : null) },
  { collection: "contactMessages", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "contact", from: r.closedAt } : null) },
  { collection: "reportRequests", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "report_request", from: r.closedAt } : null) },
  { collection: "dataRequests", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "data_request", from: r.closedAt } : null) },
  { collection: "storySubmissions", field: "closedAt", pick: (r) => (r.closedAt ? { policy: "story_submission", from: r.closedAt } : null) },
  {
    collection: "donations",
    field: "createdAt",
    pick: (r) => {
      if (r.status === "cancelled" && r.cancelledAt && !r.receivedAt) return { policy: "donation.unfulfilled", from: r.cancelledAt };
      if (r.receivedAt) return { policy: "donation.financial", from: r.receivedAt };
      return null;
    },
  },
  { collection: "donors", field: "createdAt", pick: (r) => (r.lastGiftAt ? { policy: "donor.profile", from: r.lastGiftAt } : null) },
  {
    collection: "newsletterSubscribers",
    field: "createdAt",
    pick: (r) => (r.status === "pending" ? { policy: "newsletter.unconfirmed", from: r.createdAt } : r.status === "unsubscribed" && r.unsubscribedAt ? { policy: "newsletter.unsubscribed", from: r.unsubscribedAt } : null),
  },
];

/** What is removed when a record is anonymised (the money and dates stay). */
function anonymisePatch(collection: string, r: Rec): Record<string, unknown> | null {
  if (collection === "donations") {
    return {
      "donor.fullName": "Anonymised donor",
      "donor.organisationName": null,
      "donor.email": "",
      "donor.emailLower": "",
      "donor.phone": null,
      comments: null,
      updatesConsent: null,
      searchTokens: [r.id.toLowerCase()],
      "retention.anonymisedAt": Date.now(),
    };
  }
  if (collection === "donors") return { email: "", emailLower: "", fullName: "Anonymised donor", organisationName: null, phone: null, searchTokens: [], updatesConsent: null, "retention.anonymisedAt": Date.now() };
  if (collection === "newsletterSubscribers") return { email: null, emailLower: null, "retention.anonymisedAt": Date.now() };
  return null;
}

async function policies(): Promise<RetentionSettings["policies"]> {
  const saved = await getStore().get<RetentionSettings>(settingsPath("retention")).catch(() => null);
  return { ...DEFAULT_RETENTION_SETTINGS.policies, ...(saved?.policies ?? {}) };
}

export async function runRetention(opts: { dryRun?: boolean; now?: Millis; scope?: RetentionScope } = {}): Promise<RetentionReport> {
  const now = opts.now ?? Date.now();
  const dryRun = opts.dryRun === true;
  const scope = opts.scope;
  const store = getStore();
  const pol = await policies();
  const report: RetentionReport = { dryRun, due: [], deleted: 0, anonymised: 0, reviews: 0, outboxPurged: 0, held: 0 };
  const admins = dryRun || scope?.root ? [] : await superAdminUids().catch(() => []);

  for (const rule of RULES) {
    // Nothing can be due before the shortest allowed period for this collection has passed.
    const page = await store.list<Rec>(at(scope, C[rule.collection]), { where: [{ field: rule.field, op: "<", value: now - DAY }], orderBy: { field: rule.field, dir: "asc" }, limit: 100 });
    for (const r of page.items) {
      const pick = rule.pick(r);
      if (!pick) continue;
      const setting = pol[pick.policy];
      if (!setting) continue;
      // Concerns are always reviewed by a person, whatever the setting says.
      const mode: RetentionMode = pick.policy === "concern" ? "review" : setting.mode;
      if (mode === "linked" || mode === "ttl") continue;
      const dueAt = pick.from + setting.days * DAY;
      if (dueAt > now) continue;
      const path = at(scope, `${C[rule.collection]}/${r.id}`);
      if (r.retention?.legalHold) {
        report.held++;
        continue;
      }
      report.due.push({ path: `${C[rule.collection]}/${r.id}`, policy: pick.policy, mode, dueAt });
      if (dryRun) continue;
      try {
        if (mode === "auto_delete") {
          await store.delete(path, { recursive: true });
          report.deleted++;
        } else if (mode === "auto_anonymise") {
          const patch = anonymisePatch(rule.collection, r);
          if (patch && !(r.retention as { anonymisedAt?: Millis } | undefined)?.anonymisedAt) {
            await store.update(path, patch);
            report.anonymised++;
          }
        } else if (mode === "review" && !r.retention?.reviewNotifiedAt) {
          await store.update(path, { "retention.reviewNotifiedAt": now });
          if (admins.length) await notify({ recipientUids: admins, kind: "system", title: `A ${pick.policy === "concern" ? "safeguarding record" : "record"} has reached its keep-until date: please review it`, href: "/admin/settings/data" });
          report.reviews++;
        }
      } catch (err) {
        log.warn("retention.item_failed", { policy: pick.policy, err });
      }
    }
  }

  // Email bodies (vars and rendered previews) go after 90 days; the log line stays.
  const old = await store.list<OutboxEmail>(at(scope, C.emailOutbox), { where: [{ field: "createdAt", op: "<", value: now - OUTBOX_BODY_DAYS * DAY }], orderBy: { field: "createdAt", dir: "asc" }, limit: 100 });
  for (const e of old.items) {
    if (e.bodyPurgedAt || (e.vars === null && e.preview === null)) continue;
    if (!dryRun) await store.update(at(scope, `${C.emailOutbox}/${e.id}`), { vars: null, preview: null, bodyPurgedAt: now });
    report.outboxPurged++;
  }

  if (!dryRun && (report.deleted || report.anonymised) && !scope?.root) {
    await store
      .runTransaction(async (tx) => {
        auditTx(tx, { actor: { kind: "system", job: "retention" }, action: "retention.run", area: "privacy", summary: `Retention: ${report.deleted} deleted, ${report.anonymised} anonymised, ${report.reviews} for review`, feed: true });
      })
      .catch(() => undefined);
  }
  return report;
}

