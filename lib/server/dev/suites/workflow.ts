import "server-only";

// Selftest suite "workflow" (F2): the generic engine (data-model §5) on the support machine, under a
// scratch root. A transition writes the record, a timeline event and an audit entry in one commit;
// a failing guard or effect writes nothing; role, edge, version and reopen-reason checks hold;
// system actors may take only system edges.

import type { AuditEntry } from "@/lib/model/domain/system";
import type { SupportRequest } from "@/lib/model/domain/support";
import { permsFor, type Role } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { listEvents } from "@/lib/server/events";
import { recipientsFor } from "@/lib/server/notify";
import { cronAuthorized, withJobLock } from "@/lib/server/cron";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { createWithReference } from "@/lib/server/references";
import { TransitionError, defineMachine, transitionResult, type TransitionInput } from "@/lib/server/workflow/flow";
import { caseRecorder, dropScratch, scratchRoot } from "../selftest";
import type { Suite } from "../types";

type Input = TransitionInput & { failEffect?: boolean };

function viewerFor(role: Role, uid: string, name: string): Viewer {
  return {
    uid,
    displayName: name,
    email: `${uid}@example.org`,
    roles: [role],
    perms: permsFor([role], []),
    viewerScopes: [],
    programmeScope: "all",
    timezone: "Africa/Banjul",
    textSize: "normal",
    authTime: Date.now(),
    mfa: false,
    backend: "local",
  };
}

function record(ref: string, status: SupportRequest["status"], verified = false): Record<string, unknown> {
  const now = Date.now();
  return {
    reference: ref,
    status,
    statusChangedAt: now,
    assignedTo: null,
    assignedName: null,
    assignedAt: null,
    followUpAt: null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: now,
    closedAt: status === "closed" ? now : null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: [ref.toLowerCase()],
    retention: { policy: "support.unsupported", retainUntil: status === "closed" ? now + 1000 : null, legalHold: false },
    source: "web_form",
    isSample: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
    category: "education",
    programmeId: "education",
    triage: { eligibility: null, verification: { status: verified ? "verified" : "in_progress", method: null, by: null, at: null } },
  };
}

const machine = defineMachine<"support", SupportRequest, Input>({
  workflow: "support",
  collection: "supportRequests",
  area: "support",
  guards: {
    approve: (ctx) => (ctx.record.triage?.verification?.status === "verified" ? null : "Check and verify the request first, then you can approve it."),
  },
  patches: {
    start_review: (ctx) =>
      ctx.record.assignedTo || !ctx.viewer ? {} : { assignedTo: ctx.viewer.uid, assignedName: ctx.viewer.displayName, assignedAt: ctx.now },
  },
  effects: {
    start_review: (ctx) => {
      ctx.tx.set(`${ctx.root}/effects/${ctx.ref}`, { ran: true, at: ctx.now });
      if (ctx.input.failEffect) throw new Error("effect failed on purpose");
    },
  },
  retainUntil: (ctx) => ctx.now + 730 * 86_400_000,
});

export const suite: Suite = {
  name: "workflow",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const root = scratchRoot();
    const year = new Date().getUTCFullYear();
    const ref = (n: number) => `HVN-SR-${year}-${String(n).padStart(4, "0")}`;
    const path = (n: number) => `${root}/supportRequests/${ref(n)}`;
    const po = viewerFor("programme_officer", "loc_selftest_po", "Awa Selftest");
    const cm = viewerFor("content_manager", "loc_selftest_cm", "Siti Selftest");
    const audits = async () => (await store.list<AuditEntry>(`${root}/auditLog`, { orderBy: { field: "at", dir: "desc" }, limit: 50 })).items;
    try {
      await store.batch((b) => {
        b.create(path(1), record(ref(1), "new"));
        b.create(path(2), record(ref(2), "new"));
        b.create(path(3), record(ref(3), "under_review"));
        b.create(path(4), record(ref(4), "closed"));
        b.create(path(5), record(ref(5), "more_info_required"));
      });

      await t.check("a support edge writes status, event and audit in one transaction", async () => {
        const out = await machine.transition({ ref: ref(1), edgeId: "start_review", actor: po, expectedVersion: 1, root });
        const rec = await store.get<SupportRequest>(path(1));
        const events = await listEvents(path(1));
        const entries = (await audits()).filter((a) => a.targetRef === ref(1));
        const effect = await store.get(`${root}/effects/${ref(1)}`);
        const ok =
          out.to === "under_review" &&
          rec?.status === "under_review" &&
          rec.version === 2 &&
          rec.assignedTo === po.uid &&
          events.items.length === 1 &&
          events.items[0].type === "status_changed" &&
          events.items[0].summary === "Awa moved this to Under review" &&
          entries.length === 1 &&
          entries[0].action === "status.change" &&
          entries[0].feed === true &&
          effect !== null;
        if (!ok) throw new Error(`status=${rec?.status} v=${rec?.version} events=${events.items.length} audits=${entries.length}`);
        return true;
      });

      await t.check("a failing effect rolls the whole transition back", async () => {
        let threw = false;
        try {
          await machine.transition({ ref: ref(2), edgeId: "start_review", actor: po, input: { failEffect: true }, root });
        } catch {
          threw = true;
        }
        const rec = await store.get<SupportRequest>(path(2));
        const events = await listEvents(path(2));
        const entries = (await audits()).filter((a) => a.targetRef === ref(2));
        return threw && rec?.status === "new" && rec.version === 1 && events.items.length === 0 && entries.length === 0;
      });

      await t.check("a guard blocks the edge with a plain sentence and writes nothing", async () => {
        try {
          await machine.transition({ ref: ref(3), edgeId: "approve", actor: po, root });
          return false;
        } catch (err) {
          const rec = await store.get<SupportRequest>(path(3));
          return err instanceof TransitionError && err.code === "guard" && /verify/.test(err.message) && rec?.status === "under_review" && rec.version === 1;
        }
      });
      await t.check("transitionResult maps a guard to { kind: 'blocked' }", async () => {
        const r = await transitionResult(() => machine.transition({ ref: ref(3), edgeId: "approve", actor: po, root }));
        return !r.ok && r.error.kind === "blocked";
      });
      await t.check("an edge not open to the role is refused", async () => {
        try {
          await machine.transition({ ref: ref(3), edgeId: "assign", actor: cm, root });
          return false;
        } catch (err) {
          return err instanceof TransitionError && err.code === "forbidden";
        }
      });
      await t.check("an edge that doesn't leave the current status is refused", async () => {
        try {
          await machine.transition({ ref: ref(3), edgeId: "complete", actor: po, root });
          return false;
        } catch (err) {
          return err instanceof TransitionError && err.code === "no_edge";
        }
      });
      await t.check("a stale version answers conflict", async () => {
        try {
          await machine.transition({ ref: ref(3), edgeId: "assign", actor: po, expectedVersion: 7, root });
          return false;
        } catch (err) {
          return err instanceof TransitionError && err.code === "conflict" && err.current?.version === 1;
        }
      });
      await t.check("reopen needs a reason of at least 10 characters, then clears closedAt", async () => {
        let refused = false;
        try {
          await machine.transition({ ref: ref(4), edgeId: "reopen", actor: po, input: { reason: "short" }, root });
        } catch (err) {
          refused = err instanceof TransitionError && err.code === "reason";
        }
        await machine.transition({ ref: ref(4), edgeId: "reopen", actor: po, input: { reason: "The family sent new documents." }, root });
        const rec = await store.get<SupportRequest>(path(4));
        const events = await listEvents(path(4));
        return refused && rec?.status === "under_review" && rec.closedAt === null && rec.retention.retainUntil === null && events.items[0]?.type === "reopened";
      });
      await t.check("system actors take only system edges", async () => {
        let refused = false;
        try {
          await machine.transition({ ref: ref(3), edgeId: "assign", actor: { kind: "system", job: "selftest" }, root });
        } catch (err) {
          refused = err instanceof TransitionError && err.code === "forbidden";
        }
        const out = await machine.transition({ ref: ref(5), edgeId: "close_no_response", actor: { kind: "system", job: "selftest" }, root });
        const rec = await store.get<SupportRequest>(path(5));
        return refused && out.to === "closed" && rec?.closedAt !== null && typeof rec?.retention.retainUntil === "number";
      });
      await t.check("allowedFor lists the steps open to the role", () => {
        const ids = machine.allowedFor({ status: "under_review" }, po).map((e) => e.id);
        return ids.includes("approve") && ids.includes("refer") && machine.allowedFor({ status: "under_review" }, cm).length === 0;
      });

      // Intake pipeline (data-model §10.1): a fake client IP keeps real rate-limit buckets untouched.
      const ip = `selftest-${randomBytes(6).toString("hex")}`;
      const request = new Request("http://localhost/selftest", { headers: { "x-forwarded-for": ip } });
      const schema = z.object({ name: z.string().trim().min(2, { error: "Please tell us your name." }).max(80) });
      let createdCount = 0;
      const intake = (fields: Record<string, string>, keepSuspected = false) => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        return runIntake({
          form: "story",
          input: fd,
          schema,
          request,
          keepSuspected,
          create: async (data, ctx) => {
            createdCount++;
            const reference = await createWithReference(
              "storySubmissions",
              (r, now) => ({ reference: r, name: data.name, suspectedSpam: ctx.suspectedSpam, consent: consentStamp(now) }),
              undefined,
              { root },
            );
            return { reference };
          },
        });
      };
      await t.check("intake: a valid submission gets a reference", async () => {
        const r = await intake({ name: "Selftest Person", _elapsed: "4000" });
        return r.status === "success" && /^HVN-SS-\d{4}-\d{4}$/.test(r.reference ?? "");
      });
      await t.check("intake: honeypot and time trap get a reference-less success and store nothing", async () => {
        const before = createdCount;
        const a = await intake({ name: "Bot", _elapsed: "4000", company_website: "spam.example" });
        const b = await intake({ name: "Bot", _elapsed: "300" });
        return a.status === "success" && !a.reference && b.status === "success" && !b.reference && createdCount === before;
      });
      await t.check("intake: keep-and-flag forms store bot hits as suspected spam", async () => {
        const r = await intake({ name: "Maybe a person", _elapsed: "100" }, true);
        if (r.status !== "success" || !r.reference) return false;
        const doc = await store.get<{ suspectedSpam: boolean }>(`${root}/storySubmissions/${r.reference}`);
        return doc?.suspectedSpam === true;
      });
      await t.check("intake: validation errors come back with the typed values", async () => {
        const r = await intake({ name: "A", _elapsed: "4000" });
        return r.status === "error" && r.code === "validation" && r.fieldErrors?.name === "Please tell us your name." && r.values?.name === "A" && r.values?._elapsed === undefined;
      });
      await t.check("cron: a job lease admits one runner at a time; bad bearer refused", async () => {
        const job = `selftest-${randomBytes(4).toString("hex")}`;
        try {
          let inner: unknown = null;
          const outer = await withJobLock(job, 60_000, async () => {
            inner = await withJobLock(job, 60_000, async () => "second");
            return "first";
          });
          const again = await withJobLock(job, 60_000, async () => "again");
          const unauthorised = !cronAuthorized(new Request("http://localhost/api/cron/tick", { headers: { authorization: "Bearer wrong" } }));
          return outer === "first" && inner === "locked" && again === "again" && unauthorised;
        } finally {
          await store.delete(`cronLocks/${job}`).catch(() => undefined);
        }
      });

      if (await store.get("staff/loc_seed_safeguarding_officer")) {
        await t.check("notify: concern alerts go to safeguarding officers only (D109)", async () => {
          const uids = await recipientsFor("concern_alert");
          return uids.includes("loc_seed_safeguarding_officer") && !uids.includes("loc_seed_programme_officer") && !uids.includes("loc_seed_content_manager");
        });
        await t.check("notify: contact messages follow category routing", async () => {
          const donation = await recipientsFor("contact_new", { contactCategory: "donation" });
          const media = await recipientsFor("contact_new", { contactCategory: "media" });
          return donation.includes("loc_seed_finance_officer") && !donation.includes("loc_seed_content_manager") && media.includes("loc_seed_content_manager");
        });
      }
      await t.check("intake: over the per-IP limit → rate_limited", async () => {
        let last: Awaited<ReturnType<typeof intake>> | null = null;
        for (let i = 0; i < 6; i++) last = await intake({ name: "Selftest Person", _elapsed: "4000" });
        return last?.status === "error" && last.code === "rate_limited";
      });
    } finally {
      await dropScratch(root);
    }
    return t.cases;
  },
};
