// GET /m/<storage key> (PLAN D98): the one same-origin route for public files in every data mode
// (local .data/storage or the private Firebase bucket). Serves only the `public/` prefix:
//   public/media/{mediaId}/{sha256-12}.webp     uploaded pictures; 410 once withdrawn
//   public/resources/{id}/{sha256-12}.pdf       public library files (immutable: content-hashed)
// Everything else (private/, quarantine/, junk) is a plain 404, so nothing reveals what exists.
// Never cached across deploys by Next itself: it reads the request params, so it is always dynamic.

import { isUsable, readMediaIndexUncached } from "@/lib/media/index";
import { log } from "@/lib/server/log";
import { assertBlobPath, getBlobStore } from "@/lib/server/storage";

const MEDIA_CACHE = "public, max-age=86400, s-maxage=86400";
const RESOURCE_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": status === 410 ? "public, max-age=300" : "no-store" },
  });
}

type Resolved = { ok: true; key: string; kind: "media" | "resources" } | { ok: false; response: Response };

async function resolve(segments: string[] | undefined): Promise<Resolved> {
  const parts = Array.isArray(segments) ? segments : [];
  const key = parts.join("/");
  if (parts[0] !== "public" || (parts[1] !== "media" && parts[1] !== "resources") || parts.length < 4) {
    return { ok: false, response: plain(404, "Not found.") };
  }
  try {
    assertBlobPath(key);
  } catch {
    return { ok: false, response: plain(404, "Not found.") };
  }
  if (parts[1] === "media") {
    // Consent can be withdrawn at any time: check the asset record on every request (D98).
    const asset = (await readMediaIndexUncached())[parts[2]];
    if (!asset) return { ok: false, response: plain(404, "Not found.") };
    if (!isUsable(asset)) return { ok: false, response: plain(410, "This picture is no longer available.") };
    return { ok: true, key, kind: "media" };
  }
  return { ok: true, key, kind: "resources" };
}

function headersFor(kind: "media" | "resources", contentType: string, size: number, fileName: string): Headers {
  const h = new Headers({
    "Content-Type": contentType,
    "Cache-Control": kind === "resources" ? RESOURCE_CACHE : MEDIA_CACHE,
    "X-Content-Type-Options": "nosniff",
  });
  if (Number.isFinite(size) && size >= 0) h.set("Content-Length", String(size));
  if (contentType === "application/pdf") h.set("Content-Disposition", `inline; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "_")}"`);
  return h;
}

export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const target = await resolve(path);
  if (!target.ok) return target.response;
  try {
    const blob = await getBlobStore().stream(target.key);
    if (!blob) return plain(404, "Not found.");
    return new Response(blob.stream, { status: 200, headers: headersFor(target.kind, blob.contentType, blob.size, path[path.length - 1]) });
  } catch (err) {
    log.error("media.serve_failed", { kind: target.kind, err });
    return plain(500, "Something went wrong. Please try again.");
  }
}

export async function HEAD(_request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const target = await resolve(path);
  if (!target.ok) return new Response(null, { status: target.response.status, headers: target.response.headers });
  try {
    const blob = await getBlobStore().stream(target.key);
    if (!blob) return new Response(null, { status: 404 });
    await blob.stream.cancel().catch(() => {});
    return new Response(null, { status: 200, headers: headersFor(target.kind, blob.contentType, blob.size, path[path.length - 1]) });
  } catch (err) {
    log.error("media.serve_failed", { kind: target.kind, err });
    return new Response(null, { status: 500 });
  }
}
