"use server";

// Media Server Actions (content-model §6.3–6.6, PLAN D53, D97–D98, D139). The upload route (A7's
// /api/admin/media/upload) re-encodes the file with sharp, stores it in quarantine and writes
// `mediaUploads/{uploadId}`; these actions claim it, move the blob to its public key
// (public/media/{mediaId}/{sha256-12}.webp, served by /m) and write the media record.
// Withdrawal takes an image (or a story/testimonial) off every page at once.

import { randomBytes } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { deniedMessage, deniedPaths } from "./access";
import { diffPaths, summarizeChanges } from "./diff";
import { COLLECTIONS } from "./registry";
import { ConsentSchema, MediaAssetSchema, type MediaAsset } from "./schema";
import { ensureSeeded, envelopeOf, recordPath, tagsFor, toRecord, type Envelope } from "./store";
import type { RecordKey } from "./types";
import { TAG } from "@/lib/cache/tags";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { isPipelineId, readMediaIndexUncached } from "@/lib/media/index";
import type { MediaUpload } from "@/lib/model/domain/media";
import type { Millis } from "@/lib/model/enums";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore, storeAvailable } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { BLOB_PATH, getBlobStore, publicUrl } from "@/lib/server/storage";

type Result<T = { version: number; at: Millis }> = ActionResult<T>;

/** A concurrent edit (stale baseVersion) or a vanished record, raised inside a transaction. */
class ConflictError extends Error {}

const UNAVAILABLE = "Photo uploads switch on once storage is connected.";

const SafeguardingInput = z.object({
  peopleVisible: z.boolean(),
  childInImage: z.boolean(),
  identifiable: z.boolean(),
  aiGenerated: z.boolean().default(false),
  consent: ConsentSchema,
  locationRisk: z.enum(["no", "yes", "unsure"]).default("no"),
});

const MetaInput = z
  .object({
    alt: z.string().trim().max(240).default(""),
    decorative: z.boolean().default(false),
    caption: z.string().trim().max(240).optional(),
    credit: z.string().trim().max(120).optional(),
    focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
    safeguarding: SafeguardingInput,
  })
  .superRefine((m, ctx) => {
    if (!m.decorative && !m.alt) ctx.addIssue({ code: "custom", message: "Please describe the photo for someone who can't see it, or mark it as decorative.", path: ["alt"] });
    if (m.safeguarding.consent.state === "valid" && !m.safeguarding.consent.recordRef) {
      ctx.addIssue({ code: "custom", message: "Please link the signed consent record.", path: ["safeguarding", "consent", "recordRef"] });
    }
  });

function validation<T>(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Result<T> {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.map(String).join(".") || "_form";
    if (fields[k] === undefined) fields[k] = i.message;
  }
  return actionError<T>({ kind: "validation", fields });
}

function writable(): boolean {
  return resolveBackend() !== "unavailable" && storeAvailable();
}

function newMediaId(): string {
  return `up-${randomBytes(8).toString("hex").slice(0, 10)}`;
}

async function claimableUpload(uploadId: string, viewer: Viewer): Promise<MediaUpload | string> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(uploadId)) return "That upload could not be found. Please upload the photo again.";
  const upload = await getStore().get<MediaUpload>(`${C.mediaUploads}/${uploadId}`);
  if (!upload || upload.status !== "pending") return "That upload could not be found. Please upload the photo again.";
  if (upload.kind !== "image") return "Only photos can be added to the library here.";
  if (upload.expireAt <= Date.now()) return "That upload has expired. Please upload the photo again.";
  if (upload.uploadedBy !== viewer.uid && !viewer.roles.includes("super_admin")) return "That upload belongs to someone else.";
  return upload;
}

function hash12(sha256: string): string {
  return sha256.toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 12).padEnd(12, "0");
}

async function settle<T>(result: Result<T>, tags: string[]): Promise<Result<T>> {
  if (result.ok) for (const t of tags) updateTag(t);
  return result;
}

/** Adds a new photo to the library from a pending upload ("up-…" id). */
export async function createMediaAsset(input: { uploadId: string; meta: unknown }): Promise<Result<{ id: string; version: number; at: Millis }>> {
  const viewer = await requireStaff("media.manage");
  type R = { id: string; version: number; at: Millis };
  const meta = MetaInput.safeParse(input.meta);
  if (!meta.success) return validation<R>(meta.error.issues);
  if (meta.data.safeguarding.consent.state !== "missing" && !viewer.perms.has("consent.status") && !viewer.perms.has("consent.manage")) {
    return actionError<R>({ kind: "forbidden", message: "Consent is recorded by the content team or the safeguarding officer.", paths: ["safeguarding.consent"] });
  }
  if (!writable()) return actionError<R>({ kind: "unavailable", message: UNAVAILABLE });
  try {
    const upload = await claimableUpload(input.uploadId, viewer);
    if (typeof upload === "string") return actionError<R>({ kind: "not_allowed", message: upload });
    const id = newMediaId();
    const key = BLOB_PATH.media(id, hash12(upload.sha256), "webp");
    await getBlobStore().move(upload.tempPath, key);
    const now = Date.now();
    const asset: MediaAsset = MediaAssetSchema.parse({
      id,
      kind: "image",
      source: "upload",
      src: publicUrl(key),
      storageKey: key,
      ...(upload.width ? { width: upload.width } : {}),
      ...(upload.height ? { height: upload.height } : {}),
      bytes: upload.sizeBytes,
      hash: upload.sha256,
      alt: meta.data.alt,
      decorative: meta.data.decorative,
      ...(meta.data.caption ? { caption: meta.data.caption } : {}),
      ...(meta.data.credit ? { credit: meta.data.credit } : {}),
      ...(meta.data.focal ? { focal: meta.data.focal } : {}),
      safeguarding: { ...meta.data.safeguarding, placeholder: false, metadataStripped: upload.metadataStripped },
      status: "active",
      uploadedBy: viewer.uid,
      uploadedAt: now,
      updatedBy: viewer.uid,
      updatedAt: now,
    });
    try {
      await getStore().runTransaction(async (tx) => {
        const fresh = await tx.get<MediaUpload>(`${C.mediaUploads}/${input.uploadId}`);
        if (!fresh || fresh.status !== "pending") throw new Error("upload already claimed");
        tx.create(`${C.media}/${id}`, { ...asset, version: 1 });
        tx.update(`${C.mediaUploads}/${input.uploadId}`, { status: "claimed", claimedAt: now, mediaId: id });
        auditTx(tx, {
          actor: actorOf(viewer),
          action: "media.upload",
          area: "content",
          summary: `${viewer.displayName} added a photo to the library`,
          feed: true,
          targetPath: `${C.media}/${id}`,
          targetRef: null,
          changes: null,
        });
      });
    } catch (err) {
      await getBlobStore().move(key, upload.tempPath).catch(() => undefined);
      throw err;
    }
    return settle(actionOk({ id, version: 1, at: now }), [TAG.media]);
  } catch (err) {
    if (err instanceof BackendUnavailableError) return actionError<R>({ kind: "unavailable", message: UNAVAILABLE });
    log.error("media.create_failed", { err });
    return actionError<R>({ kind: "not_allowed", message: "The photo could not be added. Please try again." });
  }
}

/**
 * Replaces the file behind an asset (a pipeline placeholder or an upload): every page using it shows
 * the new picture at once, under a new content-hashed URL. The safeguarding answers describe the new file.
 */
export async function replaceMediaFile(input: { assetId: string; uploadId: string; baseVersion: number; meta: unknown }): Promise<Result> {
  const viewer = await requireStaff("media.manage");
  const meta = MetaInput.safeParse(input.meta);
  if (!meta.success) return validation(meta.error.issues);
  if (!writable()) return actionError({ kind: "unavailable", message: UNAVAILABLE });
  try {
    const index = await readMediaIndexUncached();
    const existing = index[input.assetId];
    if (!existing) return actionError({ kind: "not_allowed", message: "That photo no longer exists." });
    const upload = await claimableUpload(input.uploadId, viewer);
    if (typeof upload === "string") return actionError({ kind: "not_allowed", message: upload });
    const key = BLOB_PATH.media(existing.id, hash12(upload.sha256), "webp");
    await getBlobStore().move(upload.tempPath, key);
    const now = Date.now();
    let previousKey: string | undefined;
    let version = 0;
    try {
      version = await getStore().runTransaction(async (tx) => {
        const stored = await tx.get<MediaAsset & { version?: number }>(`${C.media}/${existing.id}`);
        const fresh = await tx.get<MediaUpload>(`${C.mediaUploads}/${input.uploadId}`);
        if ((stored?.version ?? 0) !== input.baseVersion) throw new ConflictError();
        if (!fresh || fresh.status !== "pending") throw new Error("upload already claimed");
        previousKey = stored?.source === "upload" ? stored.storageKey : undefined;
        const next = MediaAssetSchema.parse({
          ...existing,
          source: "upload",
          src: publicUrl(key),
          storageKey: key,
          poster: undefined,
          kind: "image",
          width: upload.width ?? undefined,
          height: upload.height ?? undefined,
          bytes: upload.sizeBytes,
          hash: upload.sha256,
          alt: meta.data.alt,
          decorative: meta.data.decorative,
          caption: meta.data.caption,
          credit: meta.data.credit,
          focal: meta.data.focal,
          safeguarding: { ...meta.data.safeguarding, placeholder: false, metadataStripped: upload.metadataStripped },
          status: "active",
          uploadedBy: viewer.uid,
          uploadedAt: now,
          updatedBy: viewer.uid,
          updatedAt: now,
        });
        const clean = JSON.parse(JSON.stringify(next)) as MediaAsset;
        tx.set(`${C.media}/${existing.id}`, { ...clean, version: (stored?.version ?? 0) + 1 });
        tx.update(`${C.mediaUploads}/${input.uploadId}`, { status: "claimed", claimedAt: now, mediaId: existing.id });
        auditTx(tx, {
          actor: actorOf(viewer),
          action: "media.replace",
          area: "content",
          summary: `${viewer.displayName} replaced the photo ${existing.id}`,
          feed: true,
          targetPath: `${C.media}/${existing.id}`,
          targetRef: null,
          changes: null,
        });
        return (stored?.version ?? 0) + 1;
      });
    } catch (err) {
      await getBlobStore().move(key, upload.tempPath).catch(() => undefined);
      if (err instanceof ConflictError) return actionError({ kind: "conflict", message: "Someone else changed this photo a moment ago. Reload and try again.", current: { version: input.baseVersion + 1, updatedBy: "someone", updatedAt: now } });
      throw err;
    }
    if (previousKey && previousKey !== key) await getBlobStore().delete(previousKey).catch((e) => log.warn("media.old_file_delete_failed", { err: e }));
    return settle(actionOk({ version, at: now }), [TAG.media]);
  } catch (err) {
    if (err instanceof BackendUnavailableError) return actionError({ kind: "unavailable", message: UNAVAILABLE });
    log.error("media.replace_failed", { err });
    return actionError({ kind: "not_allowed", message: "The photo could not be replaced. Please try again." });
  }
}


const MetaPatch = z.object({
  alt: z.string().trim().max(240).optional(),
  decorative: z.boolean().optional(),
  caption: z.string().trim().max(240).optional(),
  credit: z.string().trim().max(120).optional(),
  focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  safeguarding: SafeguardingInput.partial().optional(),
});

/** Edits an asset's description, focal point and safeguarding answers (pipeline assets get an override record). */
export async function updateMediaMeta(input: { assetId: string; baseVersion: number; meta: unknown }): Promise<Result> {
  const viewer = await requireStaff("media.manage", "consent.status", "consent.manage");
  const patch = MetaPatch.safeParse(input.meta);
  if (!patch.success) return validation(patch.error.issues);
  if (!writable()) return actionError({ kind: "unavailable", message: "Saving isn't switched on for this site yet." });
  try {
    const index = await readMediaIndexUncached();
    const existing = index[input.assetId];
    if (!existing) return actionError({ kind: "not_allowed", message: "That photo no longer exists." });
    const candidate = {
      ...existing,
      ...(patch.data.alt !== undefined ? { alt: patch.data.alt } : {}),
      ...(patch.data.decorative !== undefined ? { decorative: patch.data.decorative } : {}),
      ...(patch.data.caption !== undefined ? { caption: patch.data.caption } : {}),
      ...(patch.data.credit !== undefined ? { credit: patch.data.credit } : {}),
      ...(patch.data.focal !== undefined ? { focal: patch.data.focal } : {}),
      safeguarding: { ...existing.safeguarding, ...(patch.data.safeguarding ?? {}) },
      updatedBy: viewer.uid,
      updatedAt: Date.now(),
    };
    const next = MediaAssetSchema.safeParse(candidate);
    if (!next.success) return validation(next.error.issues);
    if (!next.data.decorative && !next.data.alt) return validation([{ path: ["alt"], message: "Please describe the photo, or mark it as decorative." }]);
    if (next.data.safeguarding.consent.state === "valid" && !next.data.safeguarding.consent.recordRef) {
      return validation([{ path: ["safeguarding", "consent", "recordRef"], message: "Please link the signed consent record." }]);
    }
    const changes = diffPaths(existing, next.data).filter((c) => c.path !== "updatedAt" && c.path !== "updatedBy");
    const denied = deniedPaths(viewer.roles, COLLECTIONS.media, changes.map((c) => c.path));
    if (denied.length) return actionError({ kind: "forbidden", message: deniedMessage(COLLECTIONS.media, denied), paths: denied });
    const now = next.data.updatedAt ?? Date.now();
    const version = await getStore().runTransaction(async (tx) => {
      const stored = await tx.get<{ version?: number }>(`${C.media}/${existing.id}`);
      if ((stored?.version ?? 0) !== input.baseVersion) throw new ConflictError();
      const clean = JSON.parse(JSON.stringify(next.data)) as MediaAsset;
      tx.set(`${C.media}/${existing.id}`, { ...clean, version: (stored?.version ?? 0) + 1 });
      auditTx(tx, {
        actor: actorOf(viewer),
        action: "media.update",
        area: "content",
        summary: `${viewer.displayName} updated the details of photo ${existing.id}${isPipelineId(existing.id) ? " (illustrative)" : ""}`,
        feed: false,
        targetPath: `${C.media}/${existing.id}`,
        targetRef: null,
        changes: summarizeChanges(changes),
      });
      return (stored?.version ?? 0) + 1;
    });
    return settle(actionOk({ version, at: now }), [TAG.media]);
  } catch (err) {
    if (err instanceof ConflictError) {
      return actionError({ kind: "conflict", message: "Someone else changed this photo a moment ago. Reload and try again.", current: { version: input.baseVersion + 1, updatedBy: "someone", updatedAt: Date.now() } });
    }
    if (err instanceof BackendUnavailableError) return actionError({ kind: "unavailable", message: "Saving isn't switched on for this site yet." });
    log.error("media.update_failed", { err });
    return actionError({ kind: "not_allowed", message: "The details could not be saved. Please try again." });
  }
}

const WithdrawInput = z.object({
  target: z.object({ kind: z.enum(["media", "story", "testimonial"]), id: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/) }),
  note: z.string().trim().max(500).optional(),
});

/**
 * Consent withdrawn (content-model §6.6): the asset, story or testimonial disappears from every page on
 * its next render (assets fall back to the neutral image; /m serves 410). Safeguarding officers,
 * content managers and super admins may do this at any time.
 */
export async function withdrawConsent(input: { target: { kind: "media" | "story" | "testimonial"; id: string }; note?: string }): Promise<Result> {
  const viewer = await requireStaff("consent.status", "consent.manage", "media.manage");
  const parsed = WithdrawInput.safeParse(input);
  if (!parsed.success) return validation(parsed.error.issues);
  if (!writable()) return actionError({ kind: "unavailable", message: "Saving isn't switched on for this site yet." });
  const { target, note } = parsed.data;
  const now = Date.now();
  try {
    if (target.kind === "media") {
      const index = await readMediaIndexUncached();
      const existing = index[target.id];
      if (!existing) return actionError({ kind: "not_allowed", message: "That photo no longer exists." });
      const version = await getStore().runTransaction(async (tx) => {
        const stored = await tx.get<{ version?: number }>(`${C.media}/${existing.id}`);
        const next = {
          ...existing,
          status: "withdrawn" as const,
          safeguarding: { ...existing.safeguarding, consent: { ...existing.safeguarding.consent, state: "withdrawn" as const } },
          updatedBy: viewer.uid,
          updatedAt: now,
        };
        const clean = JSON.parse(JSON.stringify(next)) as MediaAsset;
        tx.set(`${C.media}/${existing.id}`, { ...clean, version: (stored?.version ?? 0) + 1 });
        auditTx(tx, {
          actor: actorOf(viewer),
          action: "media.consent_withdraw",
          area: "content",
          summary: `${viewer.displayName} withdrew consent for photo ${existing.id}`,
          feed: true,
          sensitive: true,
          targetPath: `${C.media}/${existing.id}`,
          targetRef: null,
          changes: [{ field: "status", from: existing.status, to: "withdrawn" }, ...(note ? [{ field: "note", from: null, to: note.slice(0, 200) }] : [])],
        });
        return (stored?.version ?? 0) + 1;
      });
      return settle(actionOk({ version, at: now }), [TAG.media]);
    }
    const collection = target.kind === "story" ? "stories" : "testimonials";
    await ensureSeeded(collection);
    const key: RecordKey = { kind: "item", collection, id: target.id };
    let data: unknown = null;
    const version = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(target.id, await tx.get<Partial<Envelope>>(recordPath(key)));
      if (!rec) throw new ConflictError();
      const withdraw = (v: unknown) =>
        v && typeof v === "object" ? { ...(v as Record<string, unknown>), consent: { ...((v as { consent?: object }).consent ?? {}), state: "withdrawn" } } : v;
      data = rec.published ?? rec.draft;
      tx.set(recordPath(key), envelopeOf({ ...rec, published: withdraw(rec.published), draft: withdraw(rec.draft), version: rec.version + 1, updatedAt: now, updatedBy: viewer.uid }, viewer.displayName));
      auditTx(tx, {
        actor: actorOf(viewer),
        action: "media.consent_withdraw",
        area: "content",
        summary: `${viewer.displayName} withdrew consent for a ${target.kind}`,
        feed: true,
        sensitive: true,
        targetPath: recordPath(key),
        targetRef: null,
        changes: note ? [{ field: "note", from: null, to: note.slice(0, 200) }] : null,
      });
      return rec.version + 1;
    });
    return settle(actionOk({ version, at: now }), tagsFor(key, data));
  } catch (err) {
    if (err instanceof ConflictError) return actionError({ kind: "not_allowed", message: "That item no longer exists." });
    if (err instanceof BackendUnavailableError) return actionError({ kind: "unavailable", message: "Saving isn't switched on for this site yet." });
    log.error("media.withdraw_failed", { err });
    return actionError({ kind: "not_allowed", message: "Consent could not be withdrawn. Please try again, or call the safeguarding officer." });
  }
}
