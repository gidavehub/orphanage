import "server-only";

// Reports & resources (admin-ux §6.8; PLAN D44, D97, D101). Content managers add and edit library
// items: a PDF (≤ 25 MB, uploaded through the signed flow and claimed here), words, a cover, who can
// get it (anyone / people must ask first) and whether it shows on the website. Public files live under
// public/resources/{id}/{sha12}.pdf (served through /m), controlled ones under private/resources/…;
// changing who can get it moves the file. Saving expires the public library tags.

import { BlockSchema } from "@/lib/content/schema";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { getMediaIndex, toPickerItem } from "@/lib/media/index";
import type { ReportRequest, Resource } from "@/lib/model/domain/library";
import type { MediaPickerItem } from "@/lib/model/dto";
import { PROGRAMME_IDS, RESOURCE_CATEGORIES, type Millis, type ProgrammeId, type ResourceAccess, type ResourceCategory } from "@/lib/model/enums";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { resourceRowsForStaff } from "@/lib/server/public/resources";
import { BLOB_PATH, blobStoreAvailable } from "@/lib/server/storage";
import { claimPdfUploadTx, moveClaimedFile, type ClaimedFile } from "@/lib/server/uploads/staff";

export type ResourceRowDTO = {
  id: string;
  slug: string;
  title: string;
  category: ResourceCategory;
  access: ResourceAccess;
  showing: boolean;
  hasFile: boolean;
  downloads: number;
  requests: number;
  waiting: number;
  coverSrc: string | null;
  seeded: boolean;
  placeholder: boolean;
  publicationDate: Millis;
};

const OPEN_REQUEST = ["new", "under_review"];

async function openRequestsByResource(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const page = await getStore().list<ReportRequest>(C.reportRequests, { where: [{ field: "status", op: "in", value: OPEN_REQUEST }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
    for (const r of page.items) if (r.resourceId) out.set(r.resourceId, (out.get(r.resourceId) ?? 0) + 1);
  } catch (err) {
    log.warn("dal.resources.open_requests_failed", { err });
  }
  return out;
}

export async function listResourcesForStaff(): Promise<{ rows: ResourceRowDTO[]; canEdit: boolean }> {
  const v = await requireStaff("resource.manage", "reportRequest.read");
  const [rows, waiting, index] = await Promise.all([resourceRowsForStaff(), openRequestsByResource(), getMediaIndex()]);
  return {
    canEdit: has(v, "resource.manage"),
    rows: rows
      .filter((r) => r.status !== "archived" && typeof r.slug === "string")
      .map((r) => {
        const cover = r.coverMediaId ? index[r.coverMediaId] : undefined;
        return {
          id: r.id,
          slug: r.slug!,
          title: r.title ?? r.slug!,
          category: (r.category ?? "organisational_policies") as ResourceCategory,
          access: (r.access ?? "public") as ResourceAccess,
          showing: r.status === "published",
          hasFile: Boolean(r.file?.storagePath),
          downloads: r.downloadCount ?? 0,
          requests: r.requestCount ?? 0,
          waiting: waiting.get(r.id) ?? 0,
          coverSrc: cover ? toPickerItem(cover).src : null,
          seeded: r.seeded,
          placeholder: r.placeholder === true,
          publicationDate: r.publicationDate ?? 0,
        };
      })
      .sort((a, b) => b.publicationDate - a.publicationDate),
  };
}

export type ResourceEditorDTO = {
  id: string | null;
  version: number;
  everPublished: boolean;
  value: {
    slug: string;
    title: string;
    category: ResourceCategory;
    access: ResourceAccess;
    showing: boolean;
    shortDescription: string;
    summary: string;
    coverMediaId: string | null;
    publicationDate: string;
    programmeIds: ProgrammeId[];
    language: string;
    featured: boolean;
  };
  file: { sizeBytes: number; pageCount: number | null } | null;
  canPublish: boolean;
  uploadsOn: boolean;
  media: MediaPickerItem[];
  publicHref: string | null;
};

const paragraphsOf = (blocks: unknown[] | undefined): string =>
  (blocks ?? [])
    .map((b) => (b && typeof b === "object" && (b as { type?: string }).type === "paragraph" ? String((b as { text?: unknown }).text ?? "") : ""))
    .filter(Boolean)
    .join("\n\n");

export async function getResourceForEditor(id: string): Promise<ResourceEditorDTO | null> {
  const v = await requireStaff("resource.manage");
  const index = await getMediaIndex();
  const media = Object.values(index)
    .filter((a) => a.kind === "image")
    .map((a) => toPickerItem(a));
  if (id === "new") {
    return {
      id: null,
      version: 0,
      everPublished: false,
      value: { slug: "", title: "", category: "annual_reports", access: "public", showing: false, shortDescription: "", summary: "", coverMediaId: null, publicationDate: new Date().toISOString().slice(0, 10), programmeIds: [], language: "English", featured: false },
      file: null,
      canPublish: has(v, "resource.publish"),
      uploadsOn: blobStoreAvailable(),
      media,
      publicHref: null,
    };
  }
  const rows = await resourceRowsForStaff();
  const r = rows.find((x) => x.id === id);
  if (!r || typeof r.slug !== "string") return null;
  const version = r.seeded ? 0 : ((r as { version?: number }).version ?? 0);
  return {
    id: r.id,
    version,
    everPublished: Boolean(r.publishedAt) || (!r.seeded && r.status === "published"),
    value: {
      slug: r.slug,
      title: r.title ?? "",
      category: (r.category ?? "annual_reports") as ResourceCategory,
      access: (r.access ?? "public") as ResourceAccess,
      showing: r.status === "published",
      shortDescription: r.shortDescription ?? "",
      summary: paragraphsOf(r.executiveSummary as unknown[] | undefined),
      coverMediaId: r.coverMediaId ?? null,
      publicationDate: new Date(r.publicationDate ?? Date.now()).toISOString().slice(0, 10),
      programmeIds: (r.programmeIds ?? []).filter((p): p is ProgrammeId => (PROGRAMME_IDS as readonly string[]).includes(p)),
      language: r.language ?? "English",
      featured: r.featured === true,
    },
    file: r.file ? { sizeBytes: r.file.sizeBytes, pageCount: r.file.pageCount } : null,
    canPublish: has(v, "resource.publish"),
    uploadsOn: blobStoreAvailable(),
    media,
    publicHref: r.status === "published" ? `/resources/${r.slug}` : null,
  };
}

export type SaveResourceInput = ResourceEditorDTO["value"] & { id: string | null; expectedVersion: number; uploadId?: string | null };

function validate(i: SaveResourceInput): Record<string, string> {
  const f: Record<string, string> = {};
  const title = i.title.trim();
  if (title.length < 3) f.title = "Please give it a title.";
  else if (title.length > 120) f.title = "Please keep the title to 120 characters.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug) || i.slug.length > 80) f.slug = "Use lowercase letters, numbers and single hyphens only.";
  if (!(RESOURCE_CATEGORIES as readonly string[]).includes(i.category)) f.category = "Choose a category.";
  if (i.access !== "public" && i.access !== "controlled") f.access = "Choose who can get it.";
  if (i.shortDescription.trim().length > 300) f.shortDescription = "Please keep this to 300 characters.";
  if (i.summary.length > 6000) f.summary = "Please keep the summary to about a page (6,000 characters).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.publicationDate)) f.publicationDate = "Choose the publication date.";
  if (i.coverMediaId !== null && !/^[A-Za-z0-9_~.-]{1,128}$/.test(i.coverMediaId)) f.coverMediaId = "Choose a picture.";
  return f;
}

/** Saves a library item (new or existing), claiming an uploaded PDF and moving files to match who can get it. */
export async function saveResource(input: SaveResourceInput): Promise<ActionResult<{ id: string; version: number }>> {
  const v = await requireStaff("resource.manage");
  const fields = validate(input);
  if (Object.keys(fields).length) return actionError({ kind: "validation", fields });
  if (input.showing && !has(v, "resource.publish")) return actionError({ kind: "forbidden", message: "Someone who can publish needs to show it on the website." });

  const id = input.id ?? input.slug;
  const path = docPath("resources", id);
  const summary = input.summary
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((text, n) => ({ id: `p${n + 1}`, type: "paragraph" as const, text: text.slice(0, 2000) }));
  const blocks = summary.filter((b) => BlockSchema.safeParse(b).success);
  const seeded = input.id ? (await resourceRowsForStaff()).find((r) => r.id === input.id)?.seeded === true : false;
  let moves: Array<[string, string]> = [];

  try {
    const out = await getStore().runTransaction(async (tx) => {
      moves = [];
      const now = Date.now();
      const cur = await tx.get<Resource & { version?: number }>(path);
      if (!input.id && cur) return { error: actionError<{ id: string; version: number }>({ kind: "validation", fields: { slug: "That web address is already used. Please choose another." } }) };
      if (input.id && cur && (cur.version ?? 0) !== input.expectedVersion) {
        return { error: actionError<{ id: string; version: number }>({ kind: "conflict", message: "Someone else changed this item. Reload to see their changes.", current: { version: cur.version ?? 0, updatedBy: "", updatedAt: cur.updatedAt ?? 0 } }) };
      }
      if (input.id && !cur && !seeded) return { error: actionError<{ id: string; version: number }>({ kind: "not_allowed", message: "This item no longer exists." }) };
      if (cur?.publishedAt && cur.slug !== input.slug) return { error: actionError<{ id: string; version: number }>({ kind: "validation", fields: { slug: "The web address can't change once it has been on the website." } }) };

      // The file: a new upload, or the current one moved when "who can get it" changed.
      let file: Resource["file"] = cur?.file ?? null;
      const dest = (sha12: string) => (input.access === "public" ? BLOB_PATH.publicResource(id, sha12) : BLOB_PATH.privateResource(id, sha12));
      if (input.uploadId) {
        const claimed = await claimPdfUploadTx(tx, v, input.uploadId, dest, now);
        if (typeof claimed === "string") return { error: actionError<{ id: string; version: number }>({ kind: "validation", fields: { file: claimed } }) };
        const c = claimed as ClaimedFile & { tempPath: string };
        moves.push([c.tempPath, c.storagePath]);
        file = { storagePath: c.storagePath, sizeBytes: c.sizeBytes, pageCount: c.pageCount, sha256: c.sha256 };
      } else if (file && cur && cur.access !== input.access) {
        const to = dest(file.sha256.slice(0, 12));
        if (to !== file.storagePath) {
          moves.push([file.storagePath, to]);
          file = { ...file, storagePath: to };
        }
      }
      if (input.showing && input.access === "public" && !file) {
        return { error: actionError<{ id: string; version: number }>({ kind: "validation", fields: { file: "A free download needs a PDF. Add the file, or choose “People must ask first”." } }) };
      }

      const publishing = input.showing && cur?.status !== "published";
      const version = (cur?.version ?? 0) + 1;
      const doc: Resource & { version: number } = {
        slug: input.slug,
        status: input.showing ? "published" : "draft",
        access: input.access,
        category: input.category,
        title: input.title.trim(),
        shortDescription: input.shortDescription.trim(),
        executiveSummary: blocks,
        coverMediaId: input.coverMediaId,
        publicationDate: Date.parse(`${input.publicationDate}T12:00:00Z`),
        programmeIds: input.programmeIds.filter((p) => (PROGRAMME_IDS as readonly string[]).includes(p)),
        language: input.language.trim().slice(0, 40) || "English",
        file,
        preview: cur?.preview ?? null,
        downloadCount: cur?.downloadCount ?? 0,
        requestCount: cur?.requestCount ?? 0,
        featured: input.featured,
        placeholder: seeded ? false : (cur?.placeholder ?? false),
        publishedAt: publishing ? now : (cur?.publishedAt ?? null),
        publishedBy: publishing ? v.uid : (cur?.publishedBy ?? null),
        createdAt: cur?.createdAt ?? now,
        updatedAt: now,
        version,
      };
      tx.set(path, doc);
      auditTx(tx, {
        actor: actorOf(v),
        action: cur || seeded ? (publishing ? "resource.publish" : "resource.update") : "resource.create",
        area: "resources",
        summary: `${v.displayName} ${cur || seeded ? (publishing ? "put live" : "updated") : "added"} “${doc.title}”`,
        feed: true,
        targetPath: path,
      });
      return { id, version };
    });
    if ("error" in out && out.error) return out.error;
    for (const [from, to] of moves) await moveClaimedFile(from, to);
    return actionOk({ id: out.id!, version: out.version! });
  } catch (err) {
    log.error("dal.resources.save_failed", { id, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}
