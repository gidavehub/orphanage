// Anti-spam field names shared by the <Honeypot/> component, client forms and the server intake
// pipeline (data-model §10.2, PLAN D94). Isomorphic constants only.

/** Visually hidden text input; any value means a bot. */
export const HONEYPOT_FIELD = "company_website";
/** Milliseconds from first render to submit, measured on the client. */
export const ELAPSED_FIELD = "_elapsed";
/** Faster than this is treated as a bot (the concern form keeps and flags instead of discarding). */
export const MIN_ELAPSED_MS = 2500;
/** Cloudflare Turnstile's response field (only when Turnstile is switched on). */
export const TURNSTILE_FIELD = "cf-turnstile-response";
/** Client-generated id that makes a double submit idempotent. */
export const SUBMISSION_ID_FIELD = "submissionId";

/** Fields that are never stored on records or echoed back to the form. */
export const CONTROL_FIELDS: readonly string[] = [HONEYPOT_FIELD, ELAPSED_FIELD, TURNSTILE_FIELD, SUBMISSION_ID_FIELD];
