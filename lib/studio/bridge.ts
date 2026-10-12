// The website studio's postMessage protocol (admin-ux §6.10; PLAN D62). The admin page (parent) and
// the preview iframe (the public site in Draft Mode with `?studio=1`) talk only through these
// messages, and both sides ignore anything that isn't from their own origin.

export type SlotBox = { id: string; top: number; height: number };

/** iframe → admin. */
export type ToStudio =
  | { t: "haven:ready"; path: string; slots: SlotBox[] }
  | { t: "haven:edit"; id: string };

/** admin → iframe. */
export type ToPreview =
  | { t: "haven:refresh" }
  | { t: "haven:scrollTo"; id: string }
  | { t: "haven:highlight"; id: string | null }
  | { t: "haven:labels"; labels: Record<string, string> };

const TO_STUDIO = new Set(["haven:ready", "haven:edit"]);
const TO_PREVIEW = new Set(["haven:refresh", "haven:scrollTo", "haven:highlight", "haven:labels"]);

/** A message for the admin page, from the same origin, or null. */
export function readToStudio(e: MessageEvent): ToStudio | null {
  if (e.origin !== window.location.origin) return null;
  const d = e.data as { t?: unknown } | null;
  return d && typeof d === "object" && typeof d.t === "string" && TO_STUDIO.has(d.t) ? (d as ToStudio) : null;
}

/** A message for the preview, from the same origin, or null. */
export function readToPreview(e: MessageEvent): ToPreview | null {
  if (e.origin !== window.location.origin) return null;
  const d = e.data as { t?: unknown } | null;
  return d && typeof d === "object" && typeof d.t === "string" && TO_PREVIEW.has(d.t) ? (d as ToPreview) : null;
}
