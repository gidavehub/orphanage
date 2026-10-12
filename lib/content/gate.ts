// The publish gate (content-model §6.5, §7.1; PLAN D46, D53). Pure: the server passes the current
// media index, the previous published value and the time. Every reason is a plain sentence the
// admin shows as it is ("This photo shows someone we can recognise. Please record their consent first.").

import { diffPaths } from "./diff";
import type { GateKind } from "./registry";
import type { MediaAsset, ReviewChecklist } from "./schema";
import { REVIEW_CHECKLIST_LABEL } from "./schema";

export type GateContext = {
  /** The media index (pipeline + stored assets) at publish time. */
  index: Readonly<Record<string, MediaAsset>>;
  /** The value currently live, if any (stat changes are compared against it). */
  previous?: unknown;
  /** The record is a seeded placeholder (// CLIENT): consent and permission gates do not apply. */
  placeholder?: boolean;
  now: number;
};

/** Every `$media` id used anywhere inside a value. */
export function mediaIdsIn(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) mediaIdsIn(v, out);
  } else if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.$media === "string") out.add(rec.$media);
    else for (const v of Object.values(rec)) mediaIdsIn(v, out);
  }
  return out;
}

function assetName(a: MediaAsset): string {
  return a.alt ? `“${a.alt.length > 60 ? `${a.alt.slice(0, 59)}…` : a.alt}”` : `“${a.id}”`;
}

/** Media consent rules (content-model §6.5 with D53), for every picture the value uses. */
export function mediaReasons(value: unknown, ctx: GateContext): string[] {
  const reasons: string[] = [];
  for (const id of mediaIdsIn(value)) {
    const a = ctx.index[id];
    if (!a) {
      reasons.push(`A picture used here (${id}) is missing. Please choose another.`);
      continue;
    }
    const consent = a.safeguarding.consent;
    if (a.status === "withdrawn" || consent.state === "withdrawn") {
      reasons.push(`The photo ${assetName(a)} has been withdrawn. Please choose another.`);
      continue;
    }
    if (a.status === "archived") {
      reasons.push(`The photo ${assetName(a)} is archived. Please choose another.`);
      continue;
    }
    const real = !a.safeguarding.aiGenerated;
    const expired = consent.expiresAt !== undefined && consent.expiresAt <= ctx.now;
    if (real && a.safeguarding.peopleVisible && a.safeguarding.identifiable && (consent.state !== "valid" || expired)) {
      reasons.push(`The photo ${assetName(a)} shows someone we can recognise. Please record their consent first.`);
      continue;
    }
    if (real && a.safeguarding.childInImage && !(consent.state === "valid" && !expired && consent.scope?.website)) {
      reasons.push(`The photo ${assetName(a)} shows a child. Written consent from a parent or guardian that covers the website is needed first.`);
    }
  }
  return reasons;
}

type WithConsent = { consent?: { state?: string; expiresAt?: number } };
type WithPermission = { permission?: { status?: string } };
type WithAllocation = { allocation?: Array<{ percent: number }>; startsAt?: number; endsAt?: number };
type WithChecklist = { review?: { checklist?: Partial<ReviewChecklist> } };
type WithReview = { lastReview?: { by?: string; at?: number } };
type StatLike = { value?: number; suffix?: string; amounts?: unknown; verification?: { status?: string; verifiedBy?: string; verifiedAt?: number } };

/** Story and testimonial consent for the content itself. */
export function consentReasons(data: unknown, ctx: GateContext): string[] {
  if (ctx.placeholder) return [];
  const c = (data as WithConsent).consent;
  const expired = c?.expiresAt !== undefined && c.expiresAt <= ctx.now;
  if (c?.state !== "valid" || expired) return ["Written consent for this story has to be recorded before it can go live."];
  return [];
}

export function permissionReasons(data: unknown, ctx: GateContext): string[] {
  if (ctx.placeholder) return [];
  if ((data as WithPermission).permission?.status !== "recorded") {
    return ["We need written permission from this partner before showing their logo."];
  }
  return [];
}

export function allocationReasons(data: unknown): string[] {
  const d = data as WithAllocation;
  const reasons: string[] = [];
  const rows = d.allocation ?? [];
  if (rows.length === 1) reasons.push("Please split “where the money goes” into at least two lines.");
  if (rows.length > 0) {
    const total = rows.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0);
    if (Math.abs(total - 100) > 0.01) reasons.push(`“Where the money goes” must add up to 100% (it adds up to ${Math.round(total * 100) / 100}%).`);
  }
  if (d.startsAt !== undefined && d.endsAt !== undefined && d.endsAt <= d.startsAt) {
    reasons.push("The appeal must end after it starts.");
  }
  return reasons;
}

/** Every item in the post review checklist must be ticked (content-model §7.1). */
export function reviewReasons(data: unknown): string[] {
  const checklist = (data as WithChecklist).review?.checklist ?? {};
  const missing = (Object.keys(REVIEW_CHECKLIST_LABEL) as Array<keyof ReviewChecklist>).filter((k) => checklist[k] !== true);
  if (missing.length === 0) return [];
  return [`Please tick every item in “Things to check” first: ${missing.map((k) => REVIEW_CHECKLIST_LABEL[k]).join(" ")}`];
}

export function policyReviewReasons(data: unknown): string[] {
  const r = (data as WithReview).lastReview;
  if (!r?.by || !r.at) return ["Please record who last reviewed this policy, and when, before it goes live."];
  return [];
}

/** D46: a changed figure cannot go live until a permitted person has checked it. */
export function statReasons(data: unknown, ctx: GateContext): string[] {
  const next = data as StatLike;
  const prev = (ctx.previous ?? null) as StatLike | null;
  const figureChanged =
    !prev ||
    diffPaths({ value: prev.value, suffix: prev.suffix ?? "", amounts: prev.amounts ?? null }, { value: next.value, suffix: next.suffix ?? "", amounts: next.amounts ?? null })
      .length > 0;
  if (!figureChanged) return [];
  const v = next.verification;
  if (v?.status !== "verified" || !v.verifiedBy || !v.verifiedAt) {
    return ["This figure hasn't been checked yet. Tick “I've checked this figure” before it goes live."];
  }
  return [];
}

/** Every reason this value cannot be published. Media consent is always checked. */
export function gateReasons(kinds: readonly GateKind[], data: unknown, ctx: GateContext): string[] {
  const reasons = [...mediaReasons(data, ctx)];
  for (const k of kinds) {
    if (k === "consent") reasons.push(...consentReasons(data, ctx));
    else if (k === "permission") reasons.push(...permissionReasons(data, ctx));
    else if (k === "allocation") reasons.push(...allocationReasons(data));
    else if (k === "review") reasons.push(...reviewReasons(data));
    else if (k === "policyReview") reasons.push(...policyReviewReasons(data));
    else if (k === "statVerification") reasons.push(...statReasons(data, ctx));
  }
  return [...new Set(reasons)];
}

/** Film-only slots (content-model §6.7): the picked asset must be a video. `paths` are dotted ("media", "film"). */
export function videoSlotReasons(data: unknown, paths: readonly string[], index: Readonly<Record<string, MediaAsset>>): string[] {
  const reasons: string[] = [];
  for (const path of paths) {
    let v: unknown = data;
    for (const part of path.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined;
    const id = v && typeof v === "object" ? (v as { $media?: unknown }).$media : undefined;
    if (typeof id === "string" && index[id] && index[id].kind !== "video") {
      reasons.push("This spot plays a film: please choose one of the films, not a photo.");
    }
  }
  return reasons;
}
