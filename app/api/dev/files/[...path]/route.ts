// GET /api/dev/files/<storage path>?t=<token> (data-model §8.4, PLAN D100): the local stand-in for
// signed storage URLs. The HMAC token names exactly this path and expires after its TTL (60 s by
// default). 404 for anything else, and unless the backend is local and we are not on Vercel.
// Files are served with nosniff, no caching and a sandbox CSP, as attachments when asked.

import type { NextRequest } from "next/server";
import { devOnly } from "@/lib/server/dev/guard";
import { assertBlobPath, getBlobStore, verifyDevFileToken } from "@/lib/server/storage";

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  devOnly();
  const token = request.nextUrl.searchParams.get("t");
  const { path } = await ctx.params;
  const key = (path ?? []).join("/");
  try {
    assertBlobPath(key);
  } catch {
    return notFound();
  }
  const grant = verifyDevFileToken(key, token);
  if (!grant) return notFound();
  const file = await getBlobStore().stream(key);
  if (!file) return notFound();
  const name = (key.split("/").pop() ?? "file").replace(/[^A-Za-z0-9._-]/g, "_");
  return new Response(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${grant.disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
