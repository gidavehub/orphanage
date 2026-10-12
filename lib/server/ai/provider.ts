import "server-only";

// Provider selection (integrations §5.1). AI_PROVIDER=auto tries Anthropic then Gemini (whichever
// have credentials); "anthropic" or "gemini" use only that one; "none" switches the writer off. An
// empty chain means the template writer (no AI) is used. Images use Gemini on Vertex unless AI_IMAGES
// is off.

import type { ZodType } from "zod";
import { env } from "@/lib/server/env";
import { anthropicModel } from "./anthropic";
import { geminiImageModel, geminiTextModel } from "./gemini";
import { AiIncomplete, AiRefusal, type ImageModel, type TextModel } from "./types";

const anthropicReady = () => Boolean(env.ai.anthropicKey);
const geminiReady = () => Boolean(env.ai.gcpProject && (env.ai.gcpServiceAccountJson || env.ai.gcpAdcFile));

/** The text models to try, in order (empty = AI off; the template writer is used). */
export function textModels(): TextModel[] {
  const want = env.ai.provider;
  if (want === "none") return [];
  const chain: TextModel[] = [];
  if ((want === "auto" || want === "anthropic") && anthropicReady()) chain.push(anthropicModel());
  if ((want === "auto" || want === "gemini") && geminiReady()) chain.push(geminiTextModel());
  return chain;
}

/** The cover-image model, or null when images are off. */
export function imageModel(): ImageModel | null {
  return geminiReady() && env.ai.images && env.ai.provider !== "none" ? geminiImageModel() : null;
}

/** True when any AI text model is available. */
export function aiAvailable(): boolean {
  return textModels().length > 0;
}

export type ChainResult<T> = { data: T; provider: TextModel["id"]; model: string; usage: { inputTokens: number; outputTokens: number }; fallbackNote: string | null };

/**
 * Runs the request down the chain: a refusal, an incomplete answer or a network error on one provider
 * tries the next. Returns null when every provider failed (the caller falls back), with the reasons.
 */
export async function generateWithChain<T>(req: Parameters<TextModel["generateObject"]>[0] & { schema: ZodType<T> }): Promise<{ result: ChainResult<T> | null; reasons: string[] }> {
  const reasons: string[] = [];
  for (const m of textModels()) {
    try {
      const out = await m.generateObject<T>(req);
      return { result: { data: out.data, provider: m.id, model: out.model, usage: out.usage, fallbackNote: reasons.length ? reasons.join("; ") : null }, reasons };
    } catch (e) {
      const why = e instanceof AiRefusal ? `${m.id} declined (${e.message})` : e instanceof AiIncomplete ? `${m.id} incomplete (${e.message})` : `${m.id} failed`;
      reasons.push(why);
    }
  }
  return { result: null, reasons };
}
