import "server-only";

// Anthropic adapter (integrations §5.2): Messages API structured output with messages.parse and
// zodOutputFormat. Effort is explicit; no temperature (current models reject it); adaptive thinking is
// the model's own default. Rate limits and connection errors become AiIncomplete so the chain moves
// on. Prompts and outputs are never logged.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/server/env";
import { AiIncomplete, AiRefusal, type TextModel } from "./types";

export function anthropicModel(): TextModel {
  const client = new Anthropic({ apiKey: env.ai.anthropicKey!, maxRetries: 2, timeout: 180_000 });
  const model = env.ai.anthropicModel;
  return {
    id: "anthropic",
    model,
    async generateObject<T>({ system, user, schema, maxOutputTokens, effort, signal }: Parameters<TextModel["generateObject"]>[0] & { schema: z.ZodType<T> }) {
      try {
        const res = await client.messages.parse(
          {
            model,
            max_tokens: maxOutputTokens,
            system,
            messages: [{ role: "user", content: user }],
            output_config: { effort, format: zodOutputFormat(schema as z.ZodType<T> & z.ZodObject) },
          },
          { signal },
        );
        if (res.stop_reason === "refusal") throw new AiRefusal((res.stop_details as { category?: string } | null)?.category ?? "refusal");
        if (res.stop_reason === "max_tokens" || res.parsed_output == null) throw new AiIncomplete(res.stop_reason ?? "no_output");
        // Lengths and enums are always re-checked with zod (providers may relax JSON-Schema keywords).
        const checked = schema.safeParse(res.parsed_output);
        if (!checked.success) throw new AiIncomplete("schema");
        return { data: checked.data, model: res.model, usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens } };
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError) throw new AiIncomplete("transient");
        throw e;
      }
    },
  };
}
