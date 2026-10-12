import "server-only";

// What the AI writer may produce (integrations §5.7): a restricted subset of the post blocks. No quotes
// (they invite fabrication) and no images (they need consent checks). Lengths are always re-validated
// with zod after a provider answers, because providers may relax some JSON-Schema keywords.

import { z } from "zod";
import { PROGRAMME_IDS } from "@/lib/model/enums";

export const AiBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(1200) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().min(1).max(80) }),
  z.object({ type: z.literal("list"), style: z.enum(["bullet", "number"]), items: z.array(z.string().min(1).max(300)).min(1).max(8) }),
  z.object({ type: z.literal("stat"), statId: z.string().min(1).max(80) }),
  z.object({ type: z.literal("cta"), kind: z.enum(["donate", "cause"]), causeSlug: z.string().max(80).optional() }),
]);
export type AiBlock = z.infer<typeof AiBlock>;

export const AiPostDraft = z.object({
  title: z.string().min(3).max(90),
  excerpt: z.string().min(10).max(220),
  category: z.enum(["impact-update", "programme-update", "appeal-update", "news"]),
  programmeIds: z.array(z.enum(PROGRAMME_IDS)).max(3),
  countries: z.array(z.string().max(4)).max(5),
  body: z.array(AiBlock).min(3).max(24),
  citations: z.array(z.object({ block: z.number().int().min(0), facts: z.array(z.string().max(12)).min(1) })).max(40),
  notesForReviewer: z.string().max(1200),
  cover: z.object({ subject: z.enum(["adults", "objects", "landscape"]), scene: z.string().max(300), country: z.string().max(4).nullable() }),
});
export type AiPostDraft = z.infer<typeof AiPostDraft>;

/** "Help me write" results. */
export const AiRewrite = z.object({ text: z.string().min(1).max(4000), changed: z.boolean() });
export const AiTitles = z.object({ titles: z.array(z.string().min(3).max(90)).length(3) });
export const AiExcerpt = z.object({ excerpt: z.string().min(10).max(220) });
