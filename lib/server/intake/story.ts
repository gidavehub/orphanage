import "server-only";

// The "Share your story" intake (public-pages §3.14, PLAN D58, data-model §10). One transaction:
//   storySubmissions/{HVN-SS-YYYY-NNNN} (contact sealed; consent stamps; parent/guardian flag)
//   + the optional adult-only photo (a verified upload token from /api/uploads → attachments/{id};
//     only images are claimed; the file leaves quarantine after the commit; D58, D96)
//   + a "created" timeline event + story_acknowledgement (only when an email was given)
//   + a "New story shared" notification for the story_new route (content managers) + an audit entry.
// The pipeline in front handles the backend check, honeypot and time trap (bots get a reference-less
// success and nothing is stored), the per-IP-hash limit (5 an hour) and the optional Turnstile.
// Nothing sensitive reaches notifications, the audit summary or search tokens: the story text stays
// on the record only, the contact details are sealed, and only the reference (plus a published
// credit name) is tokenised.

import type { FormState } from "@/lib/forms/types";
import type { AllowedMime, AttachmentMeta } from "@/lib/model/domain/case";
import type { StorySubmission } from "@/lib/model/domain/engagement";
import { STORY_SUBMITTER_ROLE_LABEL } from "@/lib/model/labels";
import { adminHrefOfRef } from "@/lib/model/refs";
import { emailLowerOf } from "@/lib/schemas/common";
import { creditName, STORY_ECHO_KEYS, storySchema, type StoryData, type StoryField } from "@/lib/schemas/forms/story";
import { auditTx } from "@/lib/server/audit";
import { newId } from "@/lib/server/db/convert";
import { docPath, subDocPath } from "@/lib/server/db/collections";
import type { Tx } from "@/lib/server/db/store";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx } from "@/lib/server/events";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { moveAttachmentFiles, verifyUploadTokens, type AttachmentMove, type VerifiedUpload } from "@/lib/server/intake/upload";
import { log } from "@/lib/server/log";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";
import { emailHash } from "@/lib/server/security/hmac";
import { sealField } from "@/lib/server/security/seal";
import { BLOB_PATH } from "@/lib/server/storage";
import type { Millis } from "@/lib/model/enums";

/** The private contact block, sealed on the record (D58). */
type StoryContact = { name: string; email: string | null; phone: string | null };

const PHOTO_EXT: Partial<Record<AllowedMime, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Writes attachments/{id} for the claimed photo inside the submission's transaction and returns the
 * move out of quarantine to run after the commit. (The shared `attachmentWritesTx` only takes the two
 * case collections; this is the same record shape for storySubmissions, label "photo".)
 */
function photoWritesTx(tx: Tx, photos: readonly VerifiedUpload[], reference: string, now: Millis): AttachmentMove[] {
  const moves: AttachmentMove[] = [];
  for (const u of photos) {
    const ext = PHOTO_EXT[u.mime];
    if (!ext) continue;
    const attId = newId();
    const storagePath = BLOB_PATH.caseAttachment("storySubmissions", reference, attId, ext);
    const meta: AttachmentMeta = {
      fileName: u.name,
      mime: u.mime,
      sizeBytes: u.size,
      sha256: u.sha256,
      storagePath,
      label: "photo",
      uploadedBy: { kind: "public" },
      uploadedAt: now,
      imageSanitised: true,
      scan: { status: "not_scanned", at: null },
      deletedAt: null,
    };
    tx.create(subDocPath("storySubmissions", reference, "attachments", attId), meta);
    moves.push({ from: BLOB_PATH.quarantine(u.uploadId), to: storagePath });
  }
  return moves;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
}

/** The complete record, field by field (no spreads of the input). */
function buildSubmission(reference: string, now: Millis, d: StoryData, photoCount: number): StorySubmission {
  const path = docPath("storySubmissions", reference);
  const displayName = d.anonymous ? null : creditName(d.name) || null;
  const contact: StoryContact = { name: d.name, email: d.email ? d.email : null, phone: d.phone };
  return {
    reference,
    status: "new",
    statusChangedAt: now,
    assignedTo: null,
    assignedName: null,
    assignedAt: null,
    followUpAt: null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: now,
    closedAt: null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: buildSearchTokens({ reference, names: displayName ? [displayName] : [] }),
    retention: { policy: "story_submission", retainUntil: null, legalHold: false },
    source: "web_form",
    createdAt: now,
    updatedAt: now,
    version: 1,

    submitterRole: d.role,
    publishWithoutName: d.anonymous,
    displayName,
    country: d.country,
    programmeId: d.programme,
    story: d.story,
    contact: sealField(path, "contact", contact),
    contactLookupHash: d.email ? emailHash(emailLowerOf(d.email)) : null,
    publishConsent: consentStamp(now),
    privacyAcknowledged: consentStamp(now),
    parentOrGuardian: d.aboutMyChild && d.guardian,
    attachmentCount: photoCount,
    createdItem: null,
    declineReason: null,
  };
}

/** Runs the pipeline for one submission and returns the form state (reference on success). */
export async function submitStory(fd: FormData): Promise<FormState<StoryField>> {
  return runIntake({
    form: "story",
    input: fd,
    schema: storySchema,
    echoKeys: STORY_ECHO_KEYS,
    create: async (d) => {
      // Resolve recipients and claim the photo before the transaction (they read staff, settings
      // and the quarantine). Only images count: a PDF sent to the photo field is left to expire.
      const [recipients, uploads] = await Promise.all([recipientsFor("story_new"), verifyUploadTokens(d.photo)]);
      const photos = uploads.filter((u) => !!PHOTO_EXT[u.mime]);
      if (photos.length < uploads.length) log.warn("story.photo_not_image", { skipped: uploads.length - photos.length });
      let moves: AttachmentMove[] = [];
      const reference = await createWithReference<StorySubmission>(
        "storySubmissions",
        (ref, now) => buildSubmission(ref, now, d, photos.length),
        async (tx, ref, now) => {
          const path = docPath("storySubmissions", ref);
          addEventTx(tx, path, {
            type: "created",
            actor: { kind: "public" },
            summary: `Story shared through the website by a ${STORY_SUBMITTER_ROLE_LABEL[d.role].toLowerCase()}`,
            at: now,
          });

          if (photos.length) {
            moves = photoWritesTx(tx, photos, ref, now);
            addEventTx(tx, path, {
              type: "attachment_added",
              actor: { kind: "public" },
              summary: "1 photo attached (adult only, location data removed)",
              at: now,
            });
          }

          if (d.email) {
            await enqueueEmailTx(tx, {
              template: "story_acknowledgement",
              to: [d.email],
              vars: { reference: ref, firstName: firstNameOf(d.name) },
              related: { path, reference: ref },
            });
            addEventTx(tx, path, {
              type: "email_queued",
              actor: { kind: "system", job: "intake" },
              summary: "Story acknowledgement email queued",
              at: now,
            });
          }

          if (recipients.length) {
            notifyTx(tx, {
              recipientUids: recipients,
              kind: "new_case",
              title: `New story shared ${ref}`,
              href: adminHrefOfRef(ref, "story"),
            });
          }

          auditTx(tx, {
            actor: { kind: "public" },
            action: "story.submit",
            area: "engagement",
            summary: `A story was shared on the website (${ref})`,
            feed: true,
            targetPath: path,
            targetRef: ref,
          });
        },
      );
      if (moves.length) await moveAttachmentFiles(moves);
      return { reference };
    },
  }) as Promise<FormState<StoryField>>;
}
