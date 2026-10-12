import "server-only";

// File downloads for the public library (PLAN D101) and controlled report delivery (D59, D112).
// Both answer with where to send the person, never with file bytes or storage paths in a page:
//   publicDownload(slug)  → the content-hashed /m/public/resources/… URL (download counted), or the
//                           page to go back to when the item is not a public file.
//   deliveryDownload(token) → a 60-second signed URL for the requested report (download counted), or
//                           null for a garbage, revoked, expired or not-yet-approved link.

import type { ReportRequest, Resource } from "@/lib/model/domain/library";
import { routes } from "@/lib/routes";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { F } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { getResource } from "@/lib/server/public/resources";
import { verifyToken } from "@/lib/server/security/hmac";
import { getBlobStore, publicUrl } from "@/lib/server/storage";

export type DownloadTarget = { kind: "file"; url: string } | { kind: "page"; url: string };

/** GET /api/resources/<slug>/download. Never throws. */
export async function publicDownload(slugRaw: string): Promise<DownloadTarget> {
  const slug = slugRaw.slice(0, 120);
  const summary = await getResource(slug).catch(() => null);
  if (!summary) return { kind: "page", url: routes.resources() };
  const page: DownloadTarget = { kind: "page", url: routes.resource(summary.slug) };
  if (summary.access !== "public") return page;
  try {
    const store = getStore();
    const path = docPath("resources", summary.id);
    const doc = await store.get<Resource>(path);
    const key = doc?.status === "published" && doc.access === "public" ? doc.file?.storagePath : null;
    if (!key || !key.startsWith("public/")) return page;
    try {
      await store.update(path, { downloadCount: F.increment(1) });
    } catch (err) {
      // A missed count never blocks the download.
      log.warn("resources.download_count_failed", { slug, err });
    }
    return { kind: "file", url: publicUrl(key) };
  } catch (err) {
    log.error("resources.download_failed", { slug, err });
    return page;
  }
}

/** GET /r/<token>: the signed URL for an approved report request, or null. Never throws. */
export async function deliveryDownload(token: string): Promise<string | null> {
  const claim = verifyToken(token, "delivery");
  const tokenId = claim?.d?.tokenId;
  if (!claim || typeof tokenId !== "string") return null;
  try {
    const store = getStore();
    const reqPath = docPath("reportRequests", claim.sub);
    const rr = await store.get<ReportRequest>(reqPath);
    const d = rr?.delivery;
    const now = Date.now();
    if (!rr || !d || d.tokenId !== tokenId || d.revokedAt || d.expiresAt < now) return null;
    if (rr.status !== "approved" && rr.status !== "sent") return null;
    if (!rr.resourceId) return null;

    const resource = await store.get<Resource>(docPath("resources", rr.resourceId));
    const key = resource?.file?.storagePath;
    if (!key) return null;

    const url = await getBlobStore().signedUrl(key, { ttlSec: 60, disposition: "attachment" });
    try {
      await store.update(reqPath, { "delivery.downloads": F.increment(1), "delivery.lastDownloadAt": now });
    } catch (err) {
      log.warn("report_delivery.count_failed", { ref: claim.sub, err });
    }
    return url;
  } catch (err) {
    log.error("report_delivery.failed", { err });
    return null;
  }
}
