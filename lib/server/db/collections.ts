import "server-only";

// Collection names and path helpers (data-model §4.0 with PLAN D32, D36, D58, D83, D92, D138).
// Content collections use content-model names; singletons live in `siteContent/{docId}`.

import { DOCUMENT_ID_RE, isValidDocumentId } from "@/lib/model/enums";

export { DOCUMENT_ID_RE, isValidDocumentId };

export const C = {
  // Cases and intake
  supportRequests: "supportRequests",
  safeguardingConcerns: "safeguardingConcerns",
  appointments: "appointments",
  volunteerApplications: "volunteerApplications",
  partnershipEnquiries: "partnershipEnquiries",
  contactMessages: "contactMessages",
  reportRequests: "reportRequests",
  storySubmissions: "storySubmissions",
  dataRequests: "dataRequests",
  // Giving
  donations: "donations",
  donationIntents: "donationIntents",
  donors: "donors",
  recurringGifts: "recurringGifts",
  stripeEvents: "stripeEvents",
  causeTotals: "causeTotals",
  sponsorProfiles: "sponsorProfiles",
  // Engagement and library
  newsletterSubscribers: "newsletterSubscribers",
  referralPartners: "referralPartners",
  resources: "resources",
  // Content (content-model; D32)
  siteContent: "siteContent",
  programmes: "programmes",
  causes: "causes",
  stats: "stats",
  stories: "stories",
  testimonials: "testimonials",
  team: "team",
  faqs: "faqs",
  partners: "partners",
  projects: "projects",
  posts: "posts",
  policies: "policies",
  media: "media",
  allocationSummaries: "allocationSummaries",
  // Media consent and uploads
  mediaConsents: "mediaConsents",
  mediaUploads: "mediaUploads",
  // AI
  aiJobs: "aiJobs",
  // Staff and auth
  staff: "staff",
  staffSessions: "staffSessions",
  invitations: "invitations",
  notifications: "notifications",
  // System
  auditLog: "auditLog",
  emailOutbox: "emailOutbox",
  emailSuppressions: "emailSuppressions",
  counters: "counters",
  rateLimits: "rateLimits",
  retentionQueue: "retentionQueue",
  settings: "settings",
  metrics: "metrics",
  cronLocks: "cronLocks",
} as const;

export type CollectionKey = keyof typeof C;

/** Subcollection names. Content items keep their last 20 versions in `versions` (D31). */
export const SUB = {
  notes: "notes",
  events: "events",
  attachments: "attachments",
  actions: "actions",
  versions: "versions",
  updates: "updates",
} as const;

export type SubKey = keyof typeof SUB;

/** Throws on ids that are not valid document ids (blocks path traversal in local mode). */
export function assertDocId(id: string): string {
  if (!isValidDocumentId(id)) throw new Error("Invalid document id.");
  return id;
}

/** "supportRequests/HVN-SR-2026-0001". */
export function docPath(c: CollectionKey, id: string): string {
  return `${C[c]}/${assertDocId(id)}`;
}

/** "supportRequests/HVN-SR-2026-0001/notes". */
export function subPath(c: CollectionKey, id: string, sub: SubKey): string {
  return `${C[c]}/${assertDocId(id)}/${SUB[sub]}`;
}

/** "supportRequests/HVN-SR-2026-0001/notes/abc". */
export function subDocPath(c: CollectionKey, id: string, sub: SubKey, subId: string): string {
  return `${subPath(c, id, sub)}/${assertDocId(subId)}`;
}

/** "settings/payment". */
export function settingsPath(id: "payment" | "org" | "notifications" | "forms" | "retention" | "emailCopy" | "seed"): string {
  return `${C.settings}/${id}`;
}
