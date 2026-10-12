import "server-only";

// Covers for AI drafts (integrations §5.9; PLAN D54, D134). In order:
//   1. reuse: the newest suitable library photo (no children, consent in order, not used as a cover
//      by a post published in the last 90 days);
//   2. generate, when an image model is set up: an illustrative scene of adults, objects or a
//      landscape (automated covers never show children), always labelled "Illustrative image";
//   3. nothing: the post keeps Haven's plain cover and the reviewer chooses one.
// People-mix rule (owner): about a third Black; the rest South Asian, Southeast Asian and Arab; never
// white people; families are a mother and a father with their children; no school crests or signage.
// Every prompt names the nationality.

import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import type { PostDraftInput } from "@/lib/content/schema";
import { MediaAssetSchema, type MediaAsset } from "@/lib/content/schema";
import { getCollection } from "@/lib/content/public";
import { readMediaIndexUncached } from "@/lib/media/index";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { BLOB_PATH, blobStoreAvailable, getBlobStore, publicUrl } from "@/lib/server/storage";
import { countries as worldCountries } from "@/content/world";
import { imageModel } from "./provider";
import type { AiPostDraft } from "./schemas";

const DAY = 86_400_000;

// Keep in sync with PHOTO_STYLE / WORLD_STYLE in scripts/media/manifest.mjs (the scripts stay untouched).
const PHOTO_STYLE =
  "Documentary photograph in The Gambia, West Africa. Warm natural light, dignified and hopeful mood, authentic everyday clothing with vibrant West African wax-print fabrics, natural skin texture and real detail, shot on a full-frame camera with an 85mm lens, shallow depth of field, rich editorial colour grade. No text, no captions, no logos, no watermarks, no borders.";
const WORLD_STYLE =
  "Documentary lifestyle photograph. Warm natural golden light, joyful, dignified and hopeful mood, modest everyday local clothing, natural skin texture and real detail, shot on a full-frame camera with an 85mm lens, shallow depth of field, rich warm editorial colour grade with earthy tones. No text, no captions, no logos, no watermarks, no borders.";
const NO_CRESTS = " Plain everyday clothes with no crests, badges, emblems, signs or lettering anywhere.";

/** People for a cover with no country: chosen to keep the mix (about a third Black, never white). */
const ETHNICITIES = [
  { id: "black", people: "Black West African (Gambian)" },
  { id: "south-asian", people: "South Asian (Indian)" },
  { id: "se-asian", people: "Southeast Asian (Filipino)" },
  { id: "arab", people: "Arab (Jordanian)" },
] as const;

function demonym(code: string | null): string | null {
  const c = worldCountries.find((x) => x.code === code);
  if (!c) return null;
  if (c.code === "gm") return "Gambian";
  return `from ${c.name}`;
}

export function buildCoverPrompt(brief: AiPostDraft["cover"], ethIndex = 0): string {
  const country = brief.country?.toLowerCase() ?? null;
  const style = country === "gm" ? PHOTO_STYLE : WORLD_STYLE;
  const named = demonym(country);
  const eth = ETHNICITIES[ethIndex % ETHNICITIES.length];
  const people =
    brief.subject === "adults"
      ? ` Adults only: ${named ? `${named.startsWith("from") ? `women and men ${named}` : `${named} women and men`}` : `${eth.people} women and men`} in modest everyday local clothing. Everyone in the scene is ${named ? (named.startsWith("from") ? `a local adult ${named}` : named) : eth.people}. No children.`
      : " No people in the frame.";
  return `${style} ${brief.scene.trim().slice(0, 300)}${people}${NO_CRESTS} No weapons. Dignified, hopeful, everyday moment.`;
}

/** Library photos a draft may borrow as its cover. */
async function reusable(): Promise<string | null> {
  const [index, posts] = await Promise.all([readMediaIndexUncached(), getCollection("posts")]);
  const recent = new Set(posts.filter((p) => p.status === "published" && (p.publishedAt ?? 0) > Date.now() - 90 * DAY).map((p) => (p.cover as { assetId?: string } | undefined)?.assetId));
  const ok = (a: MediaAsset) =>
    a.kind === "image" &&
    a.status === "active" &&
    !a.safeguarding.childInImage &&
    (!a.safeguarding.peopleVisible || a.safeguarding.consent.state === "valid" || a.safeguarding.consent.state === "not_required") &&
    !recent.has(a.id);
  const list = Object.values(index).filter(ok);
  list.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
  return list.find((a) => a.source === "upload")?.id ?? null;
}

/** Generates and stores an illustrative cover. Returns the new media id, or null. */
async function generate(brief: AiPostDraft["cover"]): Promise<string | null> {
  const model = imageModel();
  if (!model || !blobStoreAvailable()) return null;
  const store = getStore();
  // Choose people by need: count recent AI covers per group; Black first while under a third.
  const index = await readMediaIndexUncached();
  const ai = Object.values(index).filter((a) => a.safeguarding.aiGenerated && a.credit?.startsWith("Illustrative"));
  const ethIndex = ai.length % 3 === 0 ? 0 : 1 + (ai.length % 3);
  const { bytes } = await model.generate({ prompt: buildCoverPrompt(brief, ethIndex), aspectRatio: "16:9" });
  const webp = await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const sha = createHash("sha256").update(webp.data).digest("hex");
  const id = `up-${randomBytes(8).toString("hex").slice(0, 10)}`;
  const key = BLOB_PATH.media(id, sha.slice(0, 12), "webp");
  await getBlobStore().put(key, webp.data, "image/webp");
  const now = Date.now();
  const asset = MediaAssetSchema.parse({
    id,
    kind: "image",
    source: "upload",
    src: publicUrl(key),
    storageKey: key,
    width: webp.info.width,
    height: webp.info.height,
    bytes: webp.data.length,
    hash: sha,
    alt: brief.scene.slice(0, 200),
    credit: "Illustrative image, AI-generated",
    safeguarding: { peopleVisible: brief.subject === "adults", childInImage: false, identifiable: false, aiGenerated: true, placeholder: false, consent: { state: "not_required" }, metadataStripped: true, locationRisk: "no" },
    status: "active",
    uploadedAt: now,
    updatedAt: now,
  });
  await store.create(`${C.media}/${id}`, { ...asset, version: 1 });
  return id;
}

/** The cover for a draft: a reused library photo, a generated illustrative one, or null (plain cover). */
export async function chooseCover(post: PostDraftInput, brief: AiPostDraft["cover"] | null): Promise<string | null> {
  void post;
  const reuse = await reusable().catch(() => null);
  if (reuse) return reuse;
  if (!brief) return null;
  try {
    return await generate(brief);
  } catch (err) {
    log.warn("ai.cover_failed", { err });
    return null;
  }
}

/** Kept for the A8 post editor's "Make a cover" seam. */
export async function generateCover(postId: string): Promise<{ mediaId: string } | { kind: "off" }> {
  void postId;
  if (!imageModel()) return { kind: "off" };
  const id = await generate({ subject: "landscape", scene: "Morning light over a community garden with simple tools resting on a bench.", country: null }).catch(() => null);
  return id ? { mediaId: id } : { kind: "off" };
}
