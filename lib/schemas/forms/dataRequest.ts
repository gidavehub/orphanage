// The privacy request form (/privacy/request; PLAN D104, data-model §11.5). Isomorphic: the client
// validates fields on blur and on submit with this schema, and the server action is authoritative.
// Field names match the DataRequest record (lib/model/domain/system.ts): fullName, email, phone,
// type, details, knownReferences. `confirm` is the requester's declaration that the information is
// their own or that they are authorised to ask; it is required but not stored as a field.

import { z } from "zod";
import type { DataRequestType } from "@/lib/model/domain/system";
import { normaliseRef } from "@/lib/model/refs";
import { emailSchema, phoneSchema, str } from "@/lib/schemas/common";

export const DATA_REQUEST_TYPES = ["access", "correction", "deletion", "stop_contact"] as const satisfies readonly DataRequestType[];

/** Form copy for each request type (title and a one-line explanation). */
export const DATA_REQUEST_TYPE_OPTIONS: Record<DataRequestType, { label: string; description: string }> = {
  access: { label: "Show me my information", description: "We send you a copy of the personal information we hold about you." },
  correction: { label: "Correct my information", description: "Something we hold is wrong or out of date. Tell us what should change." },
  deletion: { label: "Delete my information", description: "We remove what we can. Some records must be kept by law, and we will explain which." },
  stop_contact: { label: "Stop contacting me", description: "We stop all emails, calls and messages to you, and keep a note so it stays that way." },
};

export const DATA_REQUEST_DETAILS_MAX = 2000;
const MAX_REFERENCES = 10;

const MSG = {
  type: "Please choose what you would like us to do.",
  confirm: "Please confirm that this request is about your own information, or that you may act for the person.",
};

/** Optional phone: empty or missing becomes null. */
const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.union([z.literal(""), phoneSchema]))
  .transform((v) => (v === "" ? null : v));

/**
 * "Any reference numbers you have": comma, semicolon or line separated; each one is normalised
 * (hvn sr 2026 12 → HVN-SR-2026-0012). Empty becomes []. An unreadable entry is named in the error.
 */
const knownReferences = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    const raw = typeof v === "string" ? v : "";
    const parts = raw
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const out: string[] = [];
    for (const p of parts) {
      const ref = normaliseRef(p);
      if (!ref) {
        ctx.addIssue({ code: "custom", message: `We couldn't read "${p.slice(0, 40)}" as a Haven reference. References start with HVN, like HVN-SR-2026-0012.` });
        return z.NEVER;
      }
      if (!out.includes(ref)) out.push(ref);
    }
    if (out.length > MAX_REFERENCES) {
      ctx.addIssue({ code: "custom", message: `Please list at most ${MAX_REFERENCES} references.` });
      return z.NEVER;
    }
    return out;
  });

export const dataRequestSchema = z.object({
  fullName: str(120, { min: 2 }),
  email: emailSchema,
  phone: optionalPhone,
  type: z.enum(DATA_REQUEST_TYPES, { error: MSG.type }),
  details: str(DATA_REQUEST_DETAILS_MAX, { min: 10, multiline: true }),
  knownReferences,
  confirm: z.literal("on", { error: MSG.confirm }),
});

export type DataRequestInput = z.input<typeof dataRequestSchema>;
export type DataRequestData = z.output<typeof dataRequestSchema>;
export type DataRequestField = keyof DataRequestInput;

/** Text fields echoed back to the form after an error (never the declaration tick). */
export const DATA_REQUEST_ECHO_KEYS: DataRequestField[] = ["fullName", "email", "phone", "type", "details", "knownReferences"];

/** The order fields appear in, for the error summary and focus. */
export const DATA_REQUEST_FIELD_ORDER: DataRequestField[] = ["type", "fullName", "email", "phone", "knownReferences", "details", "confirm"];
