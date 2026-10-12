// POST /api/dev/content (PLAN §5.3): a practice-mode helper for acceptance checks. 404 unless the
// backend is local and we are not on Vercel (devOnly, D90).
//   { id: DocId, data, publish?: boolean }  saves a singleton (data is merged over its current value,
//                                           so a partial object is fine) and, with publish, puts it live
//   { action: "aiDraft" }                   creates a sample AI draft post waiting for review
// Writes run through the real pipeline as the system actor "dev-content". Tags are expired at once
// (revalidateTag(tag, { expire: 0 })) so the very next request shows the change, which is what a
// scripted check needs.

import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { z } from "zod";
import { DOC_IDS } from "@/lib/content/ids";
import { createAiDraft } from "@/lib/content/posts";
import { loadDoc } from "@/lib/content/read";
import { contentStore, writeDoc } from "@/lib/content/store";
import { systemActor } from "@/lib/model/viewer";
import { devOnly } from "@/lib/server/dev/guard";

const NO_STORE = { "Cache-Control": "no-store" };

const Body = z.union([
  z.object({ action: z.literal("aiDraft") }),
  z.object({ id: z.enum(DOC_IDS), data: z.record(z.string(), z.unknown()), publish: z.boolean().optional() }),
]);

export async function POST(request: Request): Promise<Response> {
  devOnly();
  await connection();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400, headers: NO_STORE });
  }
  const actor = systemActor("dev-content");

  if ("action" in parsed.data) {
    const result = await createAiDraft(
      {
        title: "A month of learning and care",
        excerpt: "A sample draft from the writing helper: what changed for children and families this month.",
        category: "impact-update",
        format: "article",
        programmeIds: ["education"],
        body: [
          { id: "p1", type: "paragraph", text: "This is a sample draft written for testing. A member of the Haven team reviews every draft before it can go live." },
          { id: "p2", type: "paragraph", text: "Children returned to school with fees, uniforms and books, and families received guidance and referrals." },
        ],
        origin: { via: "monthly", model: "sample", promptVersion: "dev-1", sources: ["Sample brief"] },
      },
      actor,
    );
    return Response.json({ action: "aiDraft", result }, { status: result.ok ? 200 : 422, headers: NO_STORE });
  }

  const { id, data, publish } = parsed.data;
  const rec = await contentStore().getDoc(id);
  const current = await loadDoc(id, { preview: true });
  const outcome = await writeDoc(actor, {
    id,
    baseVersion: rec?.version ?? 0,
    data: { ...(current as Record<string, unknown>), ...data },
    intent: publish ? "publish" : "draft",
  });
  for (const tag of outcome.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ id, result: outcome.result, tags: outcome.tags }, { status: outcome.result.ok ? 200 : 422, headers: NO_STORE });
}
