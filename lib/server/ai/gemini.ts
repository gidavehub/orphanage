import "server-only";

// Gemini on Vertex adapter (integrations §5.3): JSON output against the zod schema's JSON Schema,
// re-validated with zod; images through the image model. Credentials: Haven's own service account in
// GOOGLE_SERVICE_ACCOUNT_JSON (raw or base64) in production; locally Application Default Credentials
// (GOOGLE_APPLICATION_CREDENTIALS). Never logs prompts or outputs.

import { GoogleGenAI, Modality } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/server/env";
import { AiIncomplete, AiRefusal, type ImageModel, type TextModel } from "./types";

function client(): GoogleGenAI {
  const raw = env.ai.gcpServiceAccountJson;
  const credentials = raw ? JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : undefined;
  return new GoogleGenAI({
    vertexai: true,
    project: env.ai.gcpProject!,
    location: env.ai.gcpLocation,
    ...(credentials ? { googleAuthOptions: { credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] } } : {}),
  });
}

export function geminiTextModel(): TextModel {
  const model = env.ai.geminiTextModel;
  return {
    id: "gemini",
    model,
    async generateObject<T>({ system, user, schema, maxOutputTokens, signal }: Parameters<TextModel["generateObject"]>[0] & { schema: z.ZodType<T> }) {
      const ai = client();
      let res;
      try {
        res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: user }] }],
          config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), maxOutputTokens, abortSignal: signal },
        });
      } catch {
        throw new AiIncomplete("transient");
      }
      const block = res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason;
      if (block === "SAFETY" || block === "PROHIBITED_CONTENT") throw new AiRefusal(String(block));
      let json: unknown;
      try {
        json = JSON.parse(res.text ?? "null");
      } catch {
        throw new AiIncomplete("json");
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new AiIncomplete("schema");
      return { data: parsed.data, model, usage: { inputTokens: res.usageMetadata?.promptTokenCount ?? 0, outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0 } };
    },
  };
}

export function geminiImageModel(): ImageModel {
  const model = env.ai.geminiImageModel;
  return {
    async generate({ prompt, aspectRatio }) {
      const ai = client();
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE], imageConfig: { aspectRatio } },
      });
      const inline = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!inline?.data) throw new AiRefusal(String(res.candidates?.[0]?.finishReason ?? "no_image"));
      return { bytes: Buffer.from(inline.data, "base64"), model };
    },
  };
}
