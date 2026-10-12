import "server-only";

// The generic workflow engine (data-model §5, PLAN D20, D75–D78). Edges come ONLY from
// lib/model/flows.ts (FLOWS); area packages add guards, patches and effects per edge id in
// lib/server/workflow/<area>.ts via defineMachine(). A transition runs in ONE transaction:
//   read the record → find the edge (must leave the current status) → check the actor (permission,
//   or system/stripe/public where the edge allows it) and the record-level authorisation → optimistic
//   version → reopen reason → guard → status/version/timestamps/retention patch → timeline event →
//   audit entry → effects (outbox, notifications, extra writes).
// Any failure aborts the whole commit. Failures are TransitionError with a plain-language message
// ("Assign someone first, then you can mark this as Assigned."); transitionResult() maps them onto
// ActionResult for Server Actions.

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { CaseEventActor } from "@/lib/model/domain/case";
import type { AuditActor, AuditArea } from "@/lib/model/domain/system";
import type { CaseDoc, Millis } from "@/lib/model/enums";
import { FLOWS, canTakeEdge, edgeById, edgesFrom, type EdgeSpec, type FlowSpec } from "@/lib/model/flows";
import { STATUS_LABEL } from "@/lib/model/labels";
import type { StatusOf, Workflow } from "@/lib/model/status";
import type { SystemActor, Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { C, assertDocId, type CollectionKey } from "@/lib/server/db/collections";
import { BackendUnavailableError, ConflictError, type DocData, type Tx, type WithId } from "@/lib/server/db/store";
import { addEventTx, eventActorOf } from "@/lib/server/events";
import { log } from "@/lib/server/log";

export type TransitionErrorCode = "not_found" | "no_edge" | "forbidden" | "conflict" | "reason" | "guard";

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly reasons: string[];
  readonly current?: { version: number; updatedBy: string; updatedAt: Millis };
  constructor(code: TransitionErrorCode, message: string, opts?: { reasons?: string[]; current?: { version: number; updatedBy: string; updatedAt: Millis } }) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
    this.reasons = opts?.reasons ?? [message];
    this.current = opts?.current;
  }
}

/** Who is taking the step: a staff member, a system job, Stripe or the public (e.g. a verify link). */
export type TransitionActor = Viewer | SystemActor | { kind: "stripe" } | { kind: "public" };

/** The common inputs an edge may need; areas extend it with their own fields. */
export type TransitionInput = {
  /** Required (≥ 10 characters) for reopen edges; used by "reason" asks. */
  reason?: string;
  [key: string]: unknown;
};

export type TransitionContext<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = {
  tx: Tx;
  workflow: W;
  path: string;
  ref: string;
  record: WithId<R>;
  edge: EdgeSpec<StatusOf<W>>;
  from: StatusOf<W>;
  to: StatusOf<W>;
  input: I;
  actor: TransitionActor;
  /** The staff member, when a person is acting. */
  viewer: Viewer | null;
  /** Short name for summaries ("Fatou", "Haven", "Stripe"). */
  actorName: string;
  now: Millis;
  /** Scratch root for selftests (prefixes every path written by the engine). */
  root?: string;
};

type Ctx<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = TransitionContext<W, R, I>;

export type GuardFn<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = (
  ctx: Ctx<W, R, I>,
) => string | string[] | null | undefined | Promise<string | string[] | null | undefined>;
export type PatchFn<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = (ctx: Ctx<W, R, I>) => DocData | Promise<DocData>;
export type EffectFn<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = (ctx: Ctx<W, R, I>) => void | Promise<void>;

export interface MachineConfig<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput = TransitionInput> {
  workflow: W;
  collection: CollectionKey;
  area: AuditArea;
  /** Per edge id: a plain-language reason the step can't be taken yet, or null. */
  guards?: Partial<Record<string, GuardFn<W, R, I>>>;
  /** Per edge id: extra fields to write with the status change (dotted keys allowed). */
  patches?: Partial<Record<string, PatchFn<W, R, I>>>;
  /** Per edge id: outbox emails, notifications and other writes in the same transaction. */
  effects?: Partial<Record<string, EffectFn<W, R, I>>>;
  /** Runs for every edge: extra effects (e.g. "notify the assignee"). */
  afterEach?: EffectFn<W, R, I>;
  /** Record-level authorisation (programme scope, contact category, own appointment). Default: allowed. */
  authorize?: (ctx: Ctx<W, R, I>) => boolean | Promise<boolean>;
  /** retention.retainUntil when the record reaches a terminal status (null = decided later). */
  retainUntil?: (ctx: Ctx<W, R, I>) => Millis | null;
  /** Timeline sentence. Default: "Fatou moved this to Assigned". Never sensitive content. */
  summary?: (ctx: Ctx<W, R, I>) => string;
}

export type TransitionRequest<I extends TransitionInput> = {
  ref: string;
  edgeId: string;
  input?: I;
  actor: TransitionActor;
  /** The version the person saw; a newer record answers "conflict". */
  expectedVersion?: number;
  /** For appointment edges open to the assigned counsellor. */
  isAssignedCounsellor?: boolean;
  /** Selftests only: a scratch root prefixed to every path. */
  root?: string;
};

export type TransitionOutcome<S extends string> = { ref: string; edgeId: string; from: S; to: S; version: number; at: Millis };

function isViewer(a: TransitionActor): a is Viewer {
  return "uid" in a && "perms" in a;
}

function actorNameOf(a: TransitionActor): string {
  if (isViewer(a)) return a.displayName.trim().split(/\s+/)[0] || "Someone";
  if (a.kind === "system") return "Haven";
  if (a.kind === "stripe") return "Stripe";
  return "The person who asked";
}

function eventActorFor(a: TransitionActor): CaseEventActor {
  if (isViewer(a)) return eventActorOf(a);
  if (a.kind === "system") return eventActorOf(a);
  return eventActorOf(a.kind);
}

function auditActorFor(a: TransitionActor): AuditActor {
  if (isViewer(a)) return actorOf(a);
  if (a.kind === "system") return actorOf(a);
  return { kind: a.kind };
}

function label<W extends Workflow>(w: W, s: StatusOf<W>): string {
  return (STATUS_LABEL[w] as Record<string, string>)[s] ?? s;
}

export type Machine<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput> = {
  readonly config: MachineConfig<W, R, I>;
  readonly flow: FlowSpec<StatusOf<W>>;
  /** Runs one edge in one transaction. Throws TransitionError (or BackendUnavailableError). */
  transition(req: TransitionRequest<I>): Promise<TransitionOutcome<StatusOf<W>>>;
  /** Edges this staff member may take from the record's status (guards are checked on submit). */
  allowedFor(record: { status: StatusOf<W> }, viewer: Viewer, ctx?: { isAssignedCounsellor?: boolean }): EdgeSpec<StatusOf<W>>[];
  /** The record path for a reference. */
  pathOf(ref: string, root?: string): string;
};

/** Builds a state machine for one workflow from FLOWS plus area guards, patches and effects. */
export function defineMachine<W extends Workflow, R extends CaseDoc<StatusOf<W>>, I extends TransitionInput = TransitionInput>(
  config: MachineConfig<W, R, I>,
): Machine<W, R, I> {
  type S = StatusOf<W>;
  const flow = FLOWS[config.workflow] as FlowSpec<S>;
  const terminal = new Set<string>(flow.terminal);

  const pathOf = (ref: string, root?: string) => {
    const p = `${C[config.collection]}/${assertDocId(ref)}`;
    return root ? `${root}/${p}` : p;
  };

  async function transition(req: TransitionRequest<I>): Promise<TransitionOutcome<S>> {
    const path = pathOf(req.ref, req.root);
    const input = (req.input ?? {}) as I;
    try {
      return await getStore().runTransaction(async (tx) => {
        const now = Date.now();
        const record = await tx.get<R>(path);
        if (!record) throw new TransitionError("not_found", "That record no longer exists.");
        const from = record.status as S;

        const edge = edgeById(config.workflow, req.edgeId) as EdgeSpec<S> | undefined;
        if (!edge || !edgesFrom(config.workflow, from).some((e) => e.id === edge.id)) {
          throw new TransitionError("no_edge", `This step isn't available while it is ${label(config.workflow, from).toLowerCase()}. Please reload to see the latest.`);
        }
        const to = edge.to;
        const viewer = isViewer(req.actor) ? req.actor : null;
        const ctx: Ctx<W, R, I> = {
          tx,
          workflow: config.workflow,
          path,
          ref: req.ref,
          record,
          edge,
          from,
          to,
          input,
          actor: req.actor,
          viewer,
          actorName: actorNameOf(req.actor),
          now,
          root: req.root,
        };

        // Who may take this edge.
        const allowed = viewer
          ? canTakeEdge(edge, viewer.perms, { isAssignedCounsellor: req.isAssignedCounsellor })
          : edge.who.includes((req.actor as { kind: "system" | "stripe" | "public" }).kind);
        if (!allowed) throw new TransitionError("forbidden", "This step isn't open to your role.");
        if (config.authorize && !(await config.authorize(ctx))) throw new TransitionError("forbidden", "This record isn't open to you.");

        // Optimistic concurrency.
        if (req.expectedVersion !== undefined && record.version !== req.expectedVersion) {
          const updatedBy = (record as unknown as { assignedName?: string | null }).assignedName ?? "Someone";
          throw new TransitionError("conflict", "Someone else changed this a moment ago. Reload to see their changes.", {
            current: { version: record.version, updatedBy, updatedAt: record.updatedAt },
          });
        }

        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        if (edge.reopen && reason.length < 10) throw new TransitionError("reason", "Please give a reason of at least 10 characters to reopen this.");

        const guard = config.guards?.[edge.id];
        if (guard) {
          const blocked = await guard(ctx);
          const reasons = Array.isArray(blocked) ? blocked.filter(Boolean) : blocked ? [blocked] : [];
          if (reasons.length) throw new TransitionError("guard", reasons[0], { reasons });
        }

        // Status, version and timestamps; then the area's own fields.
        const isMove = from !== to;
        const patch: DocData = { version: record.version + 1, updatedAt: now, lastActivityAt: now, seenBy: viewer ? [viewer.uid] : [] };
        if (isMove) {
          patch.status = to;
          patch.statusChangedAt = now;
          if (terminal.has(to) && !terminal.has(from)) {
            patch.closedAt = now;
            const retainUntil = config.retainUntil?.(ctx);
            if (retainUntil !== undefined) patch["retention.retainUntil"] = retainUntil;
          } else if (terminal.has(from) && !terminal.has(to)) {
            patch.closedAt = null;
            patch["retention.retainUntil"] = null;
          }
        }
        const extra = config.patches?.[edge.id];
        if (extra) Object.assign(patch, await extra(ctx));
        tx.update(path, patch);

        // Timeline and audit, same commit.
        const statusLabel = label(config.workflow, to);
        const summary = config.summary?.(ctx) ?? (isMove ? `${ctx.actorName} moved this to ${statusLabel}` : `${ctx.actorName}: ${edge.verb}`);
        addEventTx(tx, path, {
          type: edge.reopen ? "reopened" : isMove ? "status_changed" : "field_updated",
          actor: eventActorFor(req.actor),
          summary,
          ...(isMove ? { from, to } : {}),
          at: now,
        });
        auditTx(
          tx,
          {
            actor: auditActorFor(req.actor),
            action: edge.reopen ? "status.reopen" : isMove ? "status.change" : "record.update",
            area: config.area,
            feed: true,
            targetPath: path,
            targetRef: req.ref,
            summary: isMove ? `${ctx.actorName} moved ${req.ref} to ${statusLabel}` : `${ctx.actorName} updated ${req.ref}: ${edge.verb}`,
            changes: isMove ? [{ field: "status", from, to }] : null,
          },
          { root: req.root },
        );

        await config.effects?.[edge.id]?.(ctx);
        await config.afterEach?.(ctx);

        return { ref: req.ref, edgeId: edge.id, from, to, version: record.version + 1, at: now };
      });
    } catch (err) {
      if (err instanceof TransitionError || err instanceof BackendUnavailableError) throw err;
      if (err instanceof ConflictError) throw new TransitionError("conflict", err.message);
      throw err;
    }
  }

  return {
    config,
    flow,
    transition,
    allowedFor: (record, viewer, ctx) => edgesFrom(config.workflow, record.status).filter((e) => canTakeEdge(e, viewer.perms, ctx)),
    pathOf,
  };
}

/**
 * Runs a transition and maps the outcome onto ActionResult for Server Actions:
 * forbidden → forbidden, guard/reason → blocked (with reasons), conflict → conflict,
 * no_edge → not_allowed, not_found → not_allowed, backend unavailable → unavailable.
 */
export async function transitionResult<S extends string>(run: () => Promise<TransitionOutcome<S>>): Promise<ActionResult<{ version: number; at: Millis; status: S }>> {
  try {
    const out = await run();
    return actionOk({ version: out.version, at: out.at, status: out.to });
  } catch (err) {
    if (err instanceof TransitionError) {
      switch (err.code) {
        case "forbidden":
          return actionError({ kind: "forbidden", message: err.message });
        case "guard":
        case "reason":
          return actionError({ kind: "blocked", message: err.message, reasons: err.reasons });
        case "conflict":
          return actionError({ kind: "conflict", message: err.message, current: err.current ?? { version: 0, updatedBy: "Someone", updatedAt: Date.now() } });
        default:
          return actionError({ kind: "not_allowed", message: err.message });
      }
    }
    if (err instanceof BackendUnavailableError) return actionError({ kind: "unavailable", message: err.message });
    log.error("workflow.transition_failed", { err });
    return actionError({ kind: "not_allowed", message: "Something went wrong and nothing was changed. Please try again." });
  }
}
