import "server-only";

// Report requests (admin-ux §6.8; PLAN D59, D112): the split view list, one request with the
// requester's email masked (Show is audited), the steps from FLOWS, and, while the email can't be
// sent (practice mode or a held email), a copyable download link for staff to pass on themselves.

import type { ReportRequest } from "@/lib/model/domain/library";
import type { OutboxEmail } from "@/lib/model/domain/system";
import { toStaffRef, type StaffRef } from "@/lib/model/dto";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis } from "@/lib/model/enums";
import type { StatusOf } from "@/lib/model/status";
import type { ActionResult } from "@/lib/forms/types";
import { actorOf, audit } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { drainAfterResponse, outboxId } from "@/lib/server/email/outbox";
import { listEvents } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { resourceRowsForStaff } from "@/lib/server/public/resources";
import { transitionResult } from "@/lib/server/workflow/flow";
import { deliveryLink, reportRequestMachine, type ReportRequestInput } from "@/lib/server/workflow/reportRequest";
import { loadForViewer, maskEmail } from "./_shared";

type S = StatusOf<"reportRequest">;

export type ReportRequestRow = { ref: string; status: S; title: string; unlisted: boolean; requester: string; organisation: string | null; country: string; createdAt: Millis };

const OPEN: S[] = ["new", "under_review", "approved"];
const DONE: S[] = ["sent", "declined", "closed"];

export async function listReportRequests(tab: "open" | "done" = "open"): Promise<{ rows: ReportRequestRow[]; counts: { open: number } }> {
  await requireStaff("reportRequest.read", "reportRequest.manage");
  const list = async (statuses: S[]) => {
    try {
      const page = await getStore().list<ReportRequest>(C.reportRequests, { where: [{ field: "status", op: "in", value: statuses }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
      return page.items;
    } catch (err) {
      log.warn("dal.reportRequests.list_failed", { err });
      return [] as Array<WithId<ReportRequest>>;
    }
  };
  const [open, done] = await Promise.all([list(OPEN), tab === "done" ? list(DONE) : Promise.resolve([] as Array<WithId<ReportRequest>>)]);
  const rows = (tab === "open" ? open : done).map((r) => ({
    ref: r.reference ?? r.id,
    status: r.status,
    title: r.resourceTitle || r.requestedTitle || "A report",
    unlisted: !r.resourceId,
    requester: r.requester.fullName.split(/\s+/).slice(0, 2).map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(" "),
    organisation: r.requester.organisation,
    country: r.requester.country,
    createdAt: r.createdAt,
  }));
  return { rows, counts: { open: open.length } };
}

export type ReportRequestDTO = {
  ref: string;
  version: number;
  status: S;
  title: string;
  unlisted: boolean;
  requestedTitle: string | null;
  resourceId: string | null;
  requester: { name: string; organisation: string | null; country: string; emailMasked: string };
  reason: string;
  createdAt: Millis;
  decision: { kind: "approved" | "declined"; by: StaffRef | null; at: Millis; note: string | null } | null;
  delivery: { expiresAt: Millis; downloads: number; revoked: boolean; expired: boolean } | null;
  /** The download link to pass on by hand while the email is held or unsent. */
  manualLink: string | null;
  emailStatus: OutboxEmail["status"] | null;
  edges: Array<EdgeSpec<S>>;
  /** For approving an unlisted request: library items with a file. */
  resourceOptions: Array<{ id: string; title: string }>;
  canManage: boolean;
  timeline: Array<{ id: string; at: Millis; text: string }>;
};

export async function getReportRequest(ref: string): Promise<ReportRequestDTO> {
  const v = await requireStaff("reportRequest.read", "reportRequest.manage");
  const loaded = await loadForViewer(v, ref);
  const r = loaded.record as unknown as WithId<ReportRequest>;
  const now = Date.now();
  const d = r.delivery;
  const [events, rows, mail] = await Promise.all([
    listEvents(loaded.path, { limit: 50 }),
    resourceRowsForStaff(),
    d ? getStore().get<OutboxEmail>(docPath("emailOutbox", outboxId("report_delivery", `${loaded.ref}~${d.tokenId}`))) : Promise.resolve(null),
  ]);
  const live = Boolean(d && !d.revokedAt && d.expiresAt > now && (r.status === "approved" || r.status === "sent"));
  return {
    ref: loaded.ref,
    version: r.version,
    status: r.status,
    title: r.resourceTitle || r.requestedTitle || "A report",
    unlisted: !r.resourceId,
    requestedTitle: r.requestedTitle,
    resourceId: r.resourceId,
    requester: { name: r.requester.fullName, organisation: r.requester.organisation, country: r.requester.country, emailMasked: maskEmail(r.requester.email) },
    reason: r.reason,
    createdAt: r.createdAt,
    decision: r.decision ? { kind: r.decision.kind, by: r.decision.by ? toStaffRef(r.decision.by, "") : null, at: r.decision.at, note: r.decision.note } : null,
    delivery: d ? { expiresAt: d.expiresAt, downloads: d.downloads, revoked: Boolean(d.revokedAt), expired: d.expiresAt <= now } : null,
    manualLink: live && d && has(v, "reportRequest.manage") && mail?.status !== "sent" ? deliveryLink(loaded.ref, d) : null,
    emailStatus: mail?.status ?? null,
    edges: reportRequestMachine.allowedFor(r, v),
    resourceOptions: rows.filter((x) => x.file?.storagePath && x.status !== "archived").map((x) => ({ id: x.id, title: x.title ?? x.id })),
    canManage: has(v, "reportRequest.manage"),
    timeline: events.items.map((e) => ({ id: e.id, at: e.at, text: e.summary })),
  };
}

export async function moveReportRequest(ref: string, edgeId: string, expectedVersion: number, input: ReportRequestInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("reportRequest.manage");
  const clean: ReportRequestInput = {
    ...(typeof input.resourceId === "string" ? { resourceId: input.resourceId } : {}),
    ...(typeof input.note === "string" ? { note: input.note.slice(0, 600) } : {}),
    ...(typeof input.reason === "string" ? { reason: input.reason.slice(0, 500) } : {}),
  };
  const r = await transitionResult(() => reportRequestMachine.transition({ ref, edgeId, actor: v, expectedVersion, input: clean }));
  if (r.ok) drainAfterResponse();
  return r as ActionResult<{ version: number; at: Millis; status: string }>;
}

/** The requester's full email for someone who manages requests (audited as sensitive). */
export async function revealRequesterEmail(ref: string): Promise<string | null> {
  const v = await requireStaff("reportRequest.manage");
  const loaded = await loadForViewer(v, ref);
  const r = loaded.record as unknown as ReportRequest;
  await audit({ actor: actorOf(v), action: "record.reveal", area: "resources", summary: `${v.displayName.split(" ")[0]} viewed the email address on ${loaded.ref}`, sensitive: true, targetPath: loaded.path, targetRef: loaded.ref });
  return r.requester.email;
}
