import "server-only";

// AI provider contracts (integrations §5.1, §5.7). Providers, the fact sheet, validators, assist, the
// monthly job and covers live beside this file (I4). AI only ever writes drafts; a person publishes.

import type { z } from "zod";

export type AiProviderId = "anthropic" | "gemini" | "template";

export interface TextModel {
  id: Exclude<AiProviderId, "template">;
  model: string;
  generateObject<T>(req: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    maxOutputTokens: number;
    effort: "low" | "medium" | "high";
    signal?: AbortSignal;
  }): Promise<{ data: T; model: string; usage: { inputTokens: number; outputTokens: number } }>;
}

export interface ImageModel {
  generate(req: { prompt: string; aspectRatio: "16:9" | "4:3" | "1:1" }): Promise<{ bytes: Buffer; model: string }>;
}

/** The provider declined (safety). The fallback chain tries the next provider. */
export class AiRefusal extends Error {
  constructor(message = "The writing assistant declined this request.") {
    super(message);
    this.name = "AiRefusal";
  }
}

/** The output was truncated or could not be parsed. */
export class AiIncomplete extends Error {
  constructor(message = "The writing assistant returned an incomplete answer.") {
    super(message);
    this.name = "AiIncomplete";
  }
}

/** A SafetyCheck finding on a draft (admin-ux §6.12). Hard flags block "Put live" until ticked. */
export type Flag = {
  id: string;
  severity: "hard" | "soft";
  blockId?: string;
  text: string;
  rule: "number" | "spelled_number" | "name" | "place" | "diagnosis" | "contact" | "citation" | "stat" | "template_todo";
};
