// The Contact form (/contact; public-pages §3.8, data-model §4.4, PLAN D81, D104). Isomorphic.
// The category list has two client-only choices that never reach the server: "privacy" (a link to
// /privacy/request, D104) and "concern" (replaces the form with the safeguarding redirect).

import { z } from "zod";
import type { FieldErrors } from "@/lib/forms/types";
import { CONTACT_CATEGORIES } from "@/lib/model/enums";
import { consentSchema, countrySchema, emailSchema, programmeSlugSchema, str } from "@/lib/schemas/common";
import { addCrossIssues, optional, optionalPhoneSchema, validateFields, type CrossIssue } from "./support";

export const CONTACT_MESSAGE_MIN = 20;
export const CONTACT_MESSAGE_MAX = 3000;
export const CONTACT_SUBJECT_MAX = 150;

/** Client-only pseudo choices in the category select. */
export const CONTACT_PSEUDO = { privacy: "privacy", concern: "concern" } as const;

export const contactFields = z.object({
  fullName: str(120, { min: 2 }),
  country: countrySchema,
  phone: optionalPhoneSchema,
  email: emailSchema,
  category: z.enum(CONTACT_CATEGORIES, { error: "Please choose what your message is about." }),
  programme: optional(programmeSlugSchema),
  subject: str(CONTACT_SUBJECT_MAX, { min: 3 }),
  message: str(CONTACT_MESSAGE_MAX, { min: CONTACT_MESSAGE_MIN, multiline: true }),
  consent: consentSchema,
});

export function contactCrossCheck(v: Record<string, unknown>): CrossIssue[] {
  if (v.category === "programme_info" && (v.programme === undefined || v.programme === null || v.programme === "")) {
    return [{ field: "programme", message: "Please choose the programme you are asking about." }];
  }
  return [];
}

export const contactSchema = contactFields.superRefine((v, ctx) => addCrossIssues(ctx, contactCrossCheck(v)));

export type ContactInput = z.input<typeof contactFields>;
export type ContactData = z.output<typeof contactFields>;
export type ContactField = keyof ContactInput;

/** On-screen order, for the error summary. */
export const CONTACT_FIELD_ORDER: readonly ContactField[] = ["fullName", "country", "phone", "email", "category", "programme", "subject", "message", "consent"];

export function validateContact(raw: Record<string, string | string[] | null | undefined>): FieldErrors {
  return validateFields(contactFields, CONTACT_FIELD_ORDER, raw, contactCrossCheck);
}

export const CONTACT_ECHO_KEYS: string[] = CONTACT_FIELD_ORDER.filter((f) => f !== "consent");
