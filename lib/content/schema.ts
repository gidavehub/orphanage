// The content schema: the single source of truth for every editable piece of public content
// (content-model §3, PLAN D37–D62). Isomorphic: the admin validates forms with these same schemas.
//
// Rules:
// - Layout limits are schema limits (content-model §3.6): staff cannot save content that breaks the
//   design, and the messages say why in plain words.
// - Every field added after launch carries .default()/.prefault(), so older stored docs still parse.
// - Objects strip unknown keys on read; the write pipeline rejects unknown keys (lib/content/diff.ts
//   extraPaths), so nothing is silently dropped from a staff edit.
// - Every persisted `*At` is epoch-ms Millis (D30). Date-only fields not ending in `At` are YYYY-MM-DD.
// - Long staff-authored text is Block[] (D44). InlineText allows **bold**, _italic_ and [links](…).

import { z } from "zod";
import type { CollectionName, DocId } from "./ids";
import { inlineIssues } from "./inline";
import {
  CONSENT_STATES,
  CURRENCIES,
  FREQUENCIES,
  PROGRAMME_IDS,
  PROGRAMME_SLUGS,
  RESOURCE_CATEGORIES,
  SUPPORT_FORM_CATEGORIES,
  type Currency,
} from "@/lib/model/enums";
import { ROUTE_KEYS, type RouteKey } from "@/lib/routes";
import { cleanText, emailSchema, httpsUrlSchema, placeSchema } from "@/lib/schemas/common";

/* ── Messages and text helpers ─────────────────────────────────────────── */

const ADD_WORDS = "Please add some words here.";
const fits = (max: number) => `Please keep this to ${max.toLocaleString("en")} characters or fewer so it fits the design.`;

/** One line of text (no line breaks), required, capped. */
export const line = (max: number) =>
  z
    .string({ error: ADD_WORDS })
    .overwrite((v) => cleanText(v))
    .min(1, { error: ADD_WORDS })
    .max(max, { error: fits(max) });

/** A paragraph of plain text (line breaks kept), required, capped. */
export const longText = (max: number) =>
  z
    .string({ error: ADD_WORDS })
    .overwrite((v) => cleanText(v, true))
    .min(1, { error: ADD_WORDS })
    .max(max, { error: fits(max) });

/** InlineText: **bold**, _italic_ and [label](https://… | /path) only (lib/content/inline.ts). */
export const inlineText = (max: number) =>
  longText(max).superRefine((v, ctx) => {
    for (const message of inlineIssues(v)) ctx.addIssue({ code: "custom", message });
  });

const millis = z.number({ error: "Please choose a date." }).int().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Please use a date like 2026-10-01." });
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Please use a month like 2026-10." });
/** Item ids and slugs: lowercase words joined by hyphens. */
export const slugId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and single hyphens only." })
  .max(80, { error: "Please keep the web address to 80 characters or fewer." });
const blockId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, { error: "Invalid block id." });
const uid = z.string().min(1).max(128);
const httpsUrl = httpsUrlSchema;
const order = z.number().int().min(0).max(10_000).default(0);

/* ── Enumerations owned by content ─────────────────────────────────────── */

export const SOCIAL_ICONS = ["facebook", "instagram", "tiktok", "x", "youtube", "linkedin", "whatsapp"] as const;
export type SocialIconName = (typeof SOCIAL_ICONS)[number];

export const CARD_TONES = ["flame", "forest", "clay"] as const;
export type CardTone = (typeof CARD_TONES)[number];

export const BRAND_TONES = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"] as const;

export const OPTIONAL_HOME_SECTIONS = ["partners", "stories", "team", "testimonials", "projects", "news"] as const;
export type OptionalHomeSection = (typeof OPTIONAL_HOME_SECTIONS)[number];

export const BUILTIN_PARTNER_LOGOS = ["care-alliance", "kids-first", "schools-trust", "global-health", "carepoint"] as const;
export type BuiltinPartnerLogo = (typeof BUILTIN_PARTNER_LOGOS)[number];

export const CAUSE_KINDS = ["general", "programme", "appeal", "project", "sponsorship"] as const;
export type CauseKind = (typeof CAUSE_KINDS)[number];

export const CAUSE_STATUSES = ["active", "paused", "completed"] as const;
export type CauseStatus = (typeof CAUSE_STATUSES)[number];

export const PROJECT_STATUSES = ["upcoming", "ongoing", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const POST_CATEGORIES = [
  "impact-update",
  "story",
  "news",
  "safeguarding",
  "partnerships",
  "appeal-update",
  "programme-update",
  "event",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const POST_CATEGORY_LABEL: Record<PostCategory, string> = {
  "impact-update": "Impact update",
  story: "Story of hope",
  news: "News",
  safeguarding: "Safeguarding",
  partnerships: "Partnerships",
  "appeal-update": "Appeal update",
  "programme-update": "Programme update",
  event: "Event",
};

export const POST_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export const POST_FORMATS = ["update", "article"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const FAQ_PLACEMENTS = ["home", "support", "donate", "involved", "resources", "programme", "safeguarding", "about"] as const;
export type FaqPlacement = (typeof FAQ_PLACEMENTS)[number];

export const PROGRAMME_NOTICE_KINDS = ["emergency", "eligibility", "medical", "legal", "assessment"] as const;
export type ProgrammeNoticeKind = (typeof PROGRAMME_NOTICE_KINDS)[number];

/** Notice tone per programme notice kind (D41, D123). */
export const PROGRAMME_NOTICE_TONE: Record<ProgrammeNoticeKind, "emergency" | "info" | "disclaimer"> = {
  emergency: "emergency",
  eligibility: "info",
  medical: "disclaimer",
  legal: "disclaimer",
  assessment: "disclaimer",
};

export const STAT_KINDS = ["programme", "finance", "organisation"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

export const STAT_SUFFIXES = ["", "+", "%", "K+"] as const;

export const VISIBILITIES = ["live", "hidden", "archived"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const POLICY_SLUGS = ["safeguarding", "privacy", "terms"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

/* ── Primitives ────────────────────────────────────────────────────────── */

export const MediaRefSchema = z.object({ $media: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/, { error: "Please choose a picture." }) });
export type MediaRef = z.output<typeof MediaRefSchema>;

export const CtaSchema = z.object({
  label: line(24),
  to: z.enum(ROUTE_KEYS as unknown as [RouteKey, ...RouteKey[]], { error: "Please choose where the button goes." }),
});
export type Cta = z.output<typeof CtaSchema>;

/** DonatHeading `lines`: 1–3 lines of at most 34 characters. */
export const HeadingLinesSchema = z
  .array(line(34))
  .min(1, { error: "Please add a heading." })
  .max(3, { error: "Headings have at most three lines." });
export type HeadingLines = z.output<typeof HeadingLinesSchema>;

/** VuHeading `parts`: 2–4 parts; odd indexes are the accent words; at most 28 characters in total. */
export const VuTitleSchema = z
  .array(line(28))
  .min(2, { error: "This heading needs at least two parts." })
  .max(4, { error: "This heading has at most four parts." })
  .refine((parts) => parts.join("").length <= 28, { error: "Please keep the whole heading to 28 characters or fewer so it fits the design." });
export type VuTitle = z.output<typeof VuTitleSchema>;

export const SectionHeaderSchema = z.object({
  eyebrow: line(48),
  lines: HeadingLinesSchema,
  intro: longText(260).optional(),
});
export type SectionHeader = z.output<typeof SectionHeaderSchema>;

export const SeoSchema = z
  .object({
    title: line(70).optional(),
    description: longText(200).optional(),
    ogImage: MediaRefSchema.optional(),
    noindex: z.boolean().optional(),
  })
  .prefault({});
export type Seo = z.output<typeof SeoSchema>;

/** Finance or programme confirmation that a figure is real (D45–D47). */
export const VerificationSchema = z
  .object({
    status: z.enum(["placeholder", "verified"]).default("placeholder"),
    /** Where the figure comes from ("Programme records, Jan–Sep 2026"). */
    evidence: longText(300).optional(),
    verifiedBy: uid.optional(),
    verifiedAt: millis.optional(),
  })
  .prefault({});
export type Verification = z.output<typeof VerificationSchema>;

export const ConsentScopeSchema = z.object({
  website: z.boolean().default(false),
  social: z.boolean().default(false),
  print: z.boolean().default(false),
  story: z.boolean().default(false),
  image: z.boolean().default(false),
  video: z.boolean().default(false),
});

/** Consent for content (D53 vocabulary). The signed form lives in `mediaConsents/{recordRef}`. */
export const ConsentSchema = z
  .object({
    state: z.enum(CONSENT_STATES).default("missing"),
    recordRef: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/).optional(),
    scope: ConsentScopeSchema.optional(),
    expiresAt: millis.optional(),
    recordedBy: uid.optional(),
    recordedAt: millis.optional(),
  })
  .prefault({});
export type Consent = z.output<typeof ConsentSchema>;

/* ── Blocks (content-model §7.2, D44) ──────────────────────────────────── */

const ParagraphBlock = z.object({ id: blockId, type: z.literal("paragraph"), text: inlineText(1200) });
const HeadingBlock = z.object({ id: blockId, type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: line(80) });
const ListBlock = z.object({
  id: blockId,
  type: z.literal("list"),
  style: z.enum(["bullet", "number"]).default("bullet"),
  items: z.array(inlineText(400)).min(1, { error: "Please add at least one item." }).max(12, { error: "Lists have at most 12 items." }),
});
const QuoteBlock = z.object({ id: blockId, type: z.literal("quote"), text: longText(400), attribution: line(80).optional() });
const ImageBlock = z.object({
  id: blockId,
  type: z.literal("image"),
  media: MediaRefSchema,
  caption: line(200).optional(),
  size: z.enum(["inline", "wide"]).default("inline"),
});
const GalleryBlock = z.object({
  id: blockId,
  type: z.literal("gallery"),
  items: z
    .array(z.object({ media: MediaRefSchema, caption: line(200).optional() }))
    .min(2, { error: "A gallery needs at least two pictures." })
    .max(6, { error: "A gallery has at most six pictures." }),
});
const CalloutBlock = z.object({
  id: blockId,
  type: z.literal("callout"),
  tone: z.enum(["info", "safeguarding", "warm"]).default("info"),
  title: line(80).optional(),
  text: inlineText(600),
});
/** Prefer `statId` (a verified figure from the stats registry); a literal figure needs its source. */
const StatBlock = z
  .object({
    id: blockId,
    type: z.literal("stat"),
    statId: slugId.optional(),
    value: line(20).optional(),
    label: line(60).optional(),
    source: line(160).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.statId) return;
    if (!b.value || !b.label || !b.source) {
      ctx.addIssue({ code: "custom", message: "Choose a figure from the impact numbers, or give the number, what it counts and where it comes from." });
    }
  });
const CtaBlock = z.object({
  id: blockId,
  type: z.literal("cta"),
  kind: z.enum(["donate", "cause", "support", "volunteer", "partner"]),
  causeSlug: slugId.optional(),
  label: line(24).optional(),
});
const VideoBlock = z.object({
  id: blockId,
  type: z.literal("video"),
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, { error: "Please paste the 11-character YouTube video id." }),
  title: line(100),
});
const DividerBlock = z.object({ id: blockId, type: z.literal("divider") });

export const BlockSchema = z.discriminatedUnion("type", [
  ParagraphBlock,
  HeadingBlock,
  ListBlock,
  QuoteBlock,
  ImageBlock,
  GalleryBlock,
  CalloutBlock,
  StatBlock,
  CtaBlock,
  VideoBlock,
  DividerBlock,
]);
export type Block = z.output<typeof BlockSchema>;
export type BlockType = Block["type"];

export const BlocksSchema = z.array(BlockSchema).max(200, { error: "This is too long for one page. Please split it." });

/* ── Page documents (D52) ──────────────────────────────────────────────── */

export const PageSectionSchema = z.object({
  eyebrow: line(48).optional(),
  title: HeadingLinesSchema.optional(),
  body: BlocksSchema.optional(),
  items: z
    .array(z.object({ title: line(80), text: inlineText(500).optional(), icon: z.string().regex(/^[a-z0-9-]{1,32}$/).optional() }))
    .max(24)
    .optional(),
  cta: CtaSchema.optional(),
});
export type PageSection = z.output<typeof PageSectionSchema>;

export const PageDocSchema = z.object({
  hero: z.object({
    eyebrow: line(48).optional(),
    title: HeadingLinesSchema,
    intro: inlineText(400).optional(),
    media: MediaRefSchema.optional(),
  }),
  seo: SeoSchema,
  sections: z.record(z.string().regex(/^[a-zA-Z][A-Za-z0-9-]{0,40}$/), PageSectionSchema).default({}),
});
export type PageDoc = z.output<typeof PageDocSchema>;

/* ── Settings documents (content-model §3.4 + D51) ─────────────────────── */

const SocialHref = z.union([z.literal("#"), httpsUrl]);
const email = emailSchema;
const phone = z.string().regex(/^\+?[0-9 ()-]{6,24}$/, { error: "Please enter a phone number using digits, spaces and an optional + at the start." });

export const SiteSettingsSchema = z.object({
  /** Brand group (super admin). */
  name: line(40),
  orgName: line(80),
  foundedYear: z.number().int().min(1900).max(2100),
  tagline: line(70),
  altTagline: line(70),
  description: longText(200),
  /** The giant footer line. */
  footerStatement: line(44),
  /** The text after "Made with ♥ ". */
  signOff: line(40),
  /** Footer line shown while any illustrative AI image with people is live (D54). */
  illustrativeNotice: longText(200),
  /** Dates on cards are formatted in this zone. */
  timeZone: line(40).default("Africa/Banjul"),
  /** Charity and NGO registration numbers (CLIENT). */
  registrations: z.array(z.object({ label: line(60), number: line(60) })).max(6).default([]),
  /** Before-launch switch (D46): once on, unverified figures never render. Super admin only. */
  figures: z.object({ hideUnverified: z.boolean().default(false) }).prefault({}),
});

export const ContactSettingsSchema = z.object({
  addressLabel: line(40),
  offices: z
    .array(z.object({ label: line(40), address: line(120), phone: phone.optional(), mapUrl: httpsUrl.optional() }))
    .min(1, { error: "Please keep at least one office." })
    .max(3, { error: "There is room for three offices." }),
  phoneLabel: line(40),
  phone,
  emailLabel: line(40),
  email,
  socials: z
    .array(z.object({ icon: z.enum(SOCIAL_ICONS), name: line(30), href: SocialHref, show: z.boolean().default(true) }))
    .max(8),
  /** Team mailboxes, used by forms, emails and page contact cards (D51). */
  teamEmails: z
    .object({
      support: email,
      safeguarding: email,
      donations: email,
      partnerships: email,
      media: email,
      privacy: email,
    }),
  hours: line(120).optional(),
  /** "We aim to reply within {…}" on form success screens. */
  responseTimes: z.object({
    support: line(40),
    contact: line(40),
    reportRequest: line(40),
    volunteer: line(40),
  }),
});

export const SafetySettingsSchema = z.object({
  emergencyNotice: longText(400),
  footerHeading: line(60),
  /** Emergency numbers by country; only verified ones ever render (D51). */
  emergencyContacts: z
    .array(z.object({ country: placeSchema, label: line(60), number: line(30), verified: z.boolean().default(false) }))
    .max(30)
    .default([]),
});

export const AnnouncementsSchema = z.object({
  ticker: z.array(line(70)).min(2, { error: "Please keep at least two messages." }).max(8, { error: "There is room for eight messages." }),
});

export const ChromeSettingsSchema = z.object({
  footerCtas: z.tuple([CtaSchema, CtaSchema]),
  donateCta: CtaSchema,
});

export const SeoSettingsSchema = z.object({
  ogLines: z.tuple([line(40), line(40)]),
  ogImage: MediaRefSchema.optional(),
});

/** settings.editorial (D48): the monthly AI draft plan. */
export const EditorialSettingsSchema = z.object({
  aiDrafting: z
    .object({
      enabled: z.boolean().default(true),
      dayOfMonth: z.number().int().min(1).max(28).default(1),
    })
    .prefault({}),
  topics: z
    .array(
      z.object({
        id: slugId,
        month: yearMonth,
        topic: line(120),
        notes: longText(600).optional(),
        programmeId: z.enum(PROGRAMME_IDS).optional(),
        milestoneDate: isoDate.optional(),
        used: z.boolean().default(false),
      }),
    )
    .max(120)
    .default([]),
  voice: longText(600),
  mustAvoid: z.array(line(80)).max(20).default([]),
  reviewerUids: z.array(uid).max(10).default([]),
  length: z.enum(["short", "article"]).default("article"),
});

/* ── Home documents (content-model §3.4) ───────────────────────────────── */

export const HomeLayoutSchema = z.object({
  hidden: z.array(z.enum(OPTIONAL_HOME_SECTIONS)).default([]),
});

export const HomeHeroSchema = z.object({
  slides: z
    .array(
      z.object({
        id: slugId,
        eyebrow: line(32),
        title: z.tuple([line(30), line(30)]),
        place: placeSchema,
        media: MediaRefSchema,
      }),
    )
    .min(1, { error: "Please keep at least one slide." })
    .max(7, { error: "There is room for seven slides." }),
  text: longText(260),
  primaryCta: CtaSchema,
  secondaryCta: CtaSchema,
});

export const HomeWorldSchema = z.object({
  eyebrow: line(48),
  title: line(90),
  intro: longText(240),
});

export const HomePartnersSchema = z.object({
  before: line(30),
  statId: slugId,
  after: line(40),
  subline: line(120),
});

export const HomeProgrammesSchema = z.object({
  eyebrow: line(48),
  lines: HeadingLinesSchema,
  cardCta: line(24),
});

export const HomeAboutSchema = z.object({
  eyebrow: line(48),
  titleLines: HeadingLinesSchema,
  body: z.array(longText(420)).min(1).max(3, { error: "There is room for three paragraphs." }),
  values: z
    .array(z.object({ label: line(18), tone: z.enum(["forest", "marigold", "flame", "night"]) }))
    .length(4, { error: "The values grid needs exactly four values." }),
  visionLabel: line(24),
  vision: longText(200),
  image: MediaRefSchema,
  cta: CtaSchema,
});

const DuoCardSchema = z.object({
  title: line(28),
  text: longText(200),
  cta: CtaSchema,
  tone: z.enum(["forest", "charcoal"]),
  image: MediaRefSchema,
});
export const HomeDuoSchema = z.object({ cards: z.tuple([DuoCardSchema, DuoCardSchema]) });

export const HomeManifestoSchema = z.object({
  media: MediaRefSchema,
  ctas: z.tuple([CtaSchema, CtaSchema]),
});

const ImpactCardSchema = z.object({ statId: slugId, tone: z.enum(["clay", "marigold", "cocoa"]) });
export const HomeImpactSchema = z.object({
  title: VuTitleSchema,
  text: longText(200),
  placeholderNote: line(120),
  cards: z.tuple([ImpactCardSchema, ImpactCardSchema, ImpactCardSchema]),
});

export const HomeFocusSchema = z.object({
  slides: z
    .array(z.object({ id: slugId, word: line(12), caption: line(120), media: MediaRefSchema }))
    .min(3, { error: "This chapter needs at least three slides." })
    .max(5, { error: "There is room for five slides." }),
});

export const HomeAppealsSchema = z.object({
  eyebrow: line(48),
  titleLines: HeadingLinesSchema,
  intro: longText(240),
  placeholderNote: line(120),
  /** Filter chips after "All" (which stays in code). */
  groups: z.array(z.object({ id: slugId, label: line(24) })).min(1).max(6),
});

export const HomeDonateSchema = z.object({
  title: VuTitleSchema,
  text: longText(240),
  media: MediaRefSchema,
  anywhereLabel: line(40),
  securityNote: line(80),
  thankYouCash: longText(240),
  thankYouKind: longText(240),
  /** Legal group (super admin). */
  updatesConsentLabel: longText(160),
  anonymousLabel: longText(160),
});

const CurrencyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  name: line(24),
  /** Smallest gift in major units. */
  min: z.number().positive(),
  /** Exactly six preset amounts (the 3 × 2 grid). */
  amounts: z.array(z.number().positive()).length(6, { error: "Please give exactly six amounts." }),
});

/** donate.config (D63): display configuration only; payment routing is settings/payment. */
export const DonateConfigSchema = z
  .object({
    defaultCurrency: z.enum(CURRENCIES),
    currencies: z.object({ GMD: CurrencyConfigSchema, USD: CurrencyConfigSchema, GBP: CurrencyConfigSchema, EUR: CurrencyConfigSchema }),
    frequencies: z.object({
      one_time: z.boolean().default(true),
      monthly: z.boolean().default(true),
      quarterly: z.boolean().default(true),
      annual: z.boolean().default(true),
    }),
    inKind: z.array(line(32)).min(3, { error: "Please list at least three kinds of item." }).max(12, { error: "There is room for twelve kinds of item." }),
  })
  .superRefine((c, ctx) => {
    const enabled = CURRENCIES.filter((k) => c.currencies[k].enabled);
    if (enabled.length === 0) ctx.addIssue({ code: "custom", message: "Please keep at least one currency switched on.", path: ["currencies"] });
    if (!c.currencies[c.defaultCurrency].enabled) {
      ctx.addIssue({ code: "custom", message: "The first currency people see must be switched on.", path: ["defaultCurrency"] });
    }
    if (!FREQUENCIES.some((f) => c.frequencies[f])) {
      ctx.addIssue({ code: "custom", message: "Please keep at least one way to give switched on.", path: ["frequencies"] });
    }
  });

export const HomeDoorsSchema = z.object({
  title: line(60),
  text: longText(240),
  primaryCta: CtaSchema,
  secondaryCta: CtaSchema,
});

export const HomeStoriesSchema = z.object({
  title: VuTitleSchema,
  intro: longText(240),
  ctas: z.tuple([CtaSchema, CtaSchema]),
});

export const HomeFounderSchema = z.object({
  eyebrow: line(48),
  titleLines: HeadingLinesSchema,
  text: longText(300),
  quoteName: line(40),
  quoteRole: line(60),
  quote: longText(200),
  image: MediaRefSchema,
  cta: CtaSchema,
});

export const HomeTeamSchema = SectionHeaderSchema;
export const HomeTestimonialsSchema = SectionHeaderSchema;

export const HomeRestoringSchema = z.object({
  titleLines: HeadingLinesSchema,
  text: longText(260),
  statIds: z.tuple([slugId, slugId, slugId, slugId]),
  image: MediaRefSchema,
  film: MediaRefSchema,
  filmTitle: line(60),
  placeholderNote: line(120),
});

export const HomeJourneySchema = z.object({
  title: line(60),
  text: longText(260),
  steps: z
    .array(z.object({ id: slugId, title: line(24), text: longText(130), image: MediaRefSchema }))
    .min(3, { error: "Please keep at least three steps." })
    .max(6, { error: "There is room for six steps." }),
});

export const HomeProjectsSchema = z.object({
  eyebrow: line(48),
  lines: HeadingLinesSchema,
  cta: CtaSchema,
  /** Three project slugs to feature; empty = the three latest live projects. */
  featured: z.array(slugId).max(3).default([]),
});

export const HomeFaqSchema = z.object({
  eyebrow: line(48),
  lines: HeadingLinesSchema,
  media: z.object({ main: MediaRefSchema, inset: MediaRefSchema, heart: MediaRefSchema }),
});

export const HomeJoinSchema = z.object({
  title: z.tuple([line(20), line(20), line(20)]),
  text: longText(160),
  media: MediaRefSchema,
  note: line(100),
});

export const HomeNewsSchema = z.object({
  eyebrow: line(48),
  lines: HeadingLinesSchema,
  intro: longText(200),
  cardCta: line(24),
  /** Three chosen post slugs; empty = the three latest published posts. */
  featured: z.array(slugId).max(3).default([]),
});

/** D128: the spec's closing band, built and seeded hidden so the approved landing stays identical. */
export const HomeFinalCtaSchema = z.object({
  visible: z.boolean().default(false),
  title: line(90),
  text: longText(240).optional(),
  buttons: z.array(CtaSchema).min(1).max(3),
});

/* ── Collections (content-model §3.5 + D37–D57) ────────────────────────── */

const ProgrammeNoticeSchema = z.object({
  kind: z.enum(PROGRAMME_NOTICE_KINDS),
  text: longText(300),
  /** Also shown in italics on the programme card (landing and /programmes). */
  showOnCard: z.boolean().default(false),
});

export const ProgrammeSchema = z
  .object({
    id: z.enum(PROGRAMME_IDS),
    slug: z.enum(PROGRAMME_SLUGS),
    order,
    title: line(28),
    fullTitle: line(60),
    headline: line(60),
    summary: longText(220),
    navBlurb: line(48),
    hero: z.object({ eyebrow: line(60), media: MediaRefSchema }),
    image: MediaRefSchema,
    overview: BlocksSchema,
    problem: z.object({
      heading: line(60),
      body: BlocksSchema,
      facts: z.array(z.object({ statId: slugId.optional(), value: line(20).optional(), label: line(80), source: line(160) })).max(6).default([]),
    }),
    support: z.object({
      heading: line(60),
      intro: longText(300).optional(),
      items: z.array(z.object({ title: line(90), text: longText(300).optional() })).min(1).max(16),
    }),
    eligibility: z.object({
      heading: line(60),
      intro: longText(300),
      /** "Who can ask" and "What we'll ask for" (D41). */
      criteria: z.object({ who: z.array(longText(200)).max(10).default([]), whatWeAsk: z.array(longText(200)).max(10).default([]) }).prefault({}),
      note: longText(300),
    }),
    process: z.object({
      heading: line(60),
      steps: z.array(z.object({ title: line(40), text: longText(220) })).min(3).max(6),
    }),
    requestCta: z.object({ label: line(32), text: longText(200), category: z.enum(SUPPORT_FORM_CATEGORIES) }),
    donateCta: z.object({ label: line(32), text: longText(200), causeSlug: slugId.optional() }),
    partnerCta: z.object({ label: line(32), text: longText(200) }),
    resourceCategories: z.array(z.enum(RESOURCE_CATEGORIES)).max(4).default([]),
    relatedResourceIds: z.array(z.string().max(128)).max(12).default([]),
    relatedStoryIds: z.array(slugId).max(12).default([]),
    faqIds: z.array(slugId).max(12).default([]),
    /** A role mailbox, never a personal one. */
    contact: z.object({ team: line(60), email, phone: phone.optional(), hours: line(120).optional() }),
    notices: z.array(ProgrammeNoticeSchema).max(4).default([]),
    seo: SeoSchema,
  })
  .superRefine((p, ctx) => {
    // The mandatory disclaimers cannot be deleted (content-model §8.1).
    const required: Partial<Record<(typeof PROGRAMME_IDS)[number], ProgrammeNoticeKind>> = {
      protection: "emergency",
      education: "eligibility",
      medical: "medical",
      psychological: "assessment",
      legal: "legal",
    };
    const kind = required[p.id];
    if (kind && !p.notices.some((n) => n.kind === kind)) {
      ctx.addIssue({ code: "custom", message: "This programme must keep its safety notice. Ask the safeguarding officer to reword it instead.", path: ["notices"] });
    }
  });

export const AllocationPartSchema = z.object({
  label: line(60),
  percent: z.number().min(0).max(100),
  note: line(160).optional(),
  tone: z.enum(BRAND_TONES).optional(),
});
export type AllocationPart = z.output<typeof AllocationPartSchema>;

/** Money group (finance): currency, goal, offlineRaised, convertedRaised, allocation, impactUnits, presetAmounts, verification. */
export const CauseSchema = z.object({
  slug: slugId,
  kind: z.enum(CAUSE_KINDS),
  order,
  featured: z.boolean().default(false),
  title: line(60),
  /** Caveat eyebrow on the cause page, e.g. "Seasonal appeal · Ramadan". */
  eyebrow: line(48).optional(),
  season: line(24),
  /** One of home.appeals.groups ids; empty for causes that are not appeal cards. */
  groupId: z.union([slugId, z.literal("")]).default(""),
  programmeId: z.enum(PROGRAMME_IDS).optional(),
  place: placeSchema.optional(),
  tone: z.enum(CARD_TONES).default("forest"),
  image: MediaRefSchema,
  summary: longText(300),
  story: BlocksSchema.default([]),
  currency: z.enum(CURRENCIES),
  /** Major units; 0 = no goal shown. */
  goal: z.number().min(0).default(0),
  /** Cash, bank and in-kind value recorded by finance before Haven's records began (major units). */
  offlineRaised: z.number().min(0).default(0),
  /** Finance-entered contributions converted into this cause's currency (D38), major units. */
  convertedRaised: z.number().min(0).default(0),
  allocation: z.array(AllocationPartSchema).max(8).default([]),
  /** YYYY-MM-DD of the budget the breakdown comes from. */
  allocationAsOf: isoDate.optional(),
  impactUnits: z.array(z.object({ amount: z.number().positive(), currency: z.enum(CURRENCIES), label: line(120) })).max(6).default([]),
  /** Overrides donate.config presets for this cause (six per currency). */
  presetAmounts: z.partialRecord(z.enum(CURRENCIES), z.array(z.number().positive()).length(6)).default({}),
  verification: VerificationSchema,
  defaultFrequency: z.enum(FREQUENCIES).default("one_time"),
  allowedFrequencies: z.array(z.enum(FREQUENCIES)).min(1).default([...FREQUENCIES]),
  inKindItems: z.array(line(32)).max(12).default([]),
  zakatEligible: z.boolean().default(false),
  startsAt: millis.optional(),
  endsAt: millis.optional(),
  status: z.enum(CAUSE_STATUSES).default("active"),
  seo: SeoSchema,
});

export const StatSchema = z.object({
  order,
  label: line(40),
  value: z.number().min(0),
  suffix: z.enum(STAT_SUFFIXES).default(""),
  /** ≤ 110 (Impact card). */
  note: longText(110).optional(),
  /** Decides who may set the value and verify it (D47). */
  kind: z.enum(STAT_KINDS),
  verification: VerificationSchema,
  /** YYYY-MM-DD the figure was counted. */
  asOf: isoDate.optional(),
  /** Finance stats: per-currency amounts, never summed (D45). */
  amounts: z.partialRecord(z.enum(CURRENCIES), z.number().min(0)).optional(),
  tone: z.enum(BRAND_TONES).optional(),
});

export const StorySchema = z.object({
  order,
  /** "A mother": a role, never a name (stories have no name field). */
  label: line(32),
  /** Programme line. */
  meta: line(32),
  programmeId: z.enum(PROGRAMME_IDS).optional(),
  /** Country only (ToR §15). */
  place: placeSchema,
  text: longText(140),
  image: MediaRefSchema,
  /** Consent for the story itself (separate from the photo's). */
  consent: ConsentSchema,
  featured: z.boolean().default(false),
  publishedAt: millis.optional(),
});

export const TestimonialSchema = z.object({
  order,
  /** Display form "Denise W."; beneficiaries use a role word ("Parent"). */
  name: line(40),
  kind: z.enum(["donor", "beneficiary", "volunteer", "partner", "professional"]),
  role: line(60),
  quote: longText(280),
  image: MediaRefSchema.optional(),
  consent: ConsentSchema,
});

export const TeamMemberSchema = z.object({
  order,
  name: line(28),
  role: line(40),
  bio: BlocksSchema.default([]),
  languages: z.array(line(30)).max(8).default([]),
  image: MediaRefSchema,
  /** 0–4: the card's fan-out has four positions. */
  socials: z.array(z.object({ icon: z.enum(SOCIAL_ICONS), href: SocialHref })).max(4, { error: "There is room for four links." }).default([]),
  showOn: z.array(z.enum(["home", "about"])).default(["home", "about"]),
});

export const FaqSchema = z.object({
  order,
  q: line(120),
  a: longText(600),
  placements: z.array(z.enum(FAQ_PLACEMENTS)).min(1, { error: "Choose at least one place to show this question." }),
  /** Safety-critical wording: safeguarding officer and super admin only. */
  locked: z.boolean().default(false),
});

export const PartnerSchema = z.object({
  order,
  name: line(60),
  url: httpsUrl.optional(),
  logo: z.union([MediaRefSchema, z.object({ builtin: z.enum(BUILTIN_PARTNER_LOGOS) })]),
  permission: z
    .object({
      status: z.enum(["pending", "recorded"]).default("pending"),
      note: longText(300).optional(),
      recordedBy: uid.optional(),
      recordedAt: millis.optional(),
    })
    .prefault({}),
});

export const ProjectSchema = z.object({
  slug: slugId,
  order,
  title: line(32),
  subtitle: line(32),
  programmeId: z.enum(PROGRAMME_IDS).optional(),
  place: placeSchema.optional(),
  status: z.enum(PROJECT_STATUSES).default("completed"),
  startedAt: millis.optional(),
  endedAt: millis.optional(),
  image: MediaRefSchema,
  summary: longText(300).optional(),
  body: BlocksSchema.default([]),
  gallery: z.array(MediaRefSchema).max(12).default([]),
  /** Only verified outcomes render publicly. */
  outcomes: z.array(z.object({ label: line(60), value: line(30), verified: z.boolean().default(false) })).max(8).default([]),
  /** Set while the project raises funds → donate deep link. */
  causeSlug: slugId.optional(),
  seo: SeoSchema,
});

export const ReviewChecklistSchema = z
  .object({
    factsChecked: z.boolean().default(false),
    figuresMatchVerifiedStats: z.boolean().default(false),
    noChildIdentified: z.boolean().default(false),
    noPreciseLocations: z.boolean().default(false),
    consentForPeopleShown: z.boolean().default(false),
    noAdviceOrDiagnosis: z.boolean().default(false),
  })
  .prefault({});
export type ReviewChecklist = z.output<typeof ReviewChecklistSchema>;

export const REVIEW_CHECKLIST_LABEL: Record<keyof ReviewChecklist, string> = {
  factsChecked: "I've checked the facts.",
  figuresMatchVerifiedStats: "Every number matches a verified figure.",
  noChildIdentified: "No child can be identified by name or face.",
  noPreciseLocations: "No town, village or street is named.",
  consentForPeopleShown: "We have consent for everyone shown.",
  noAdviceOrDiagnosis: "It gives no medical or legal advice and no diagnosis.",
};

const PostOriginSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("human") }),
    z.object({
      kind: z.literal("ai"),
      /** ai_notes (from staff notes) or ai_monthly (the monthly draft). */
      via: z.enum(["notes", "monthly"]),
      model: line(80),
      promptVersion: line(40),
      briefTopicId: slugId.optional(),
      generatedAt: millis,
      sources: z.array(line(200)).max(40).default([]),
    }),
  ])
  .prefault({ kind: "human" });

export const PostSchema = z.object({
  /** Editable until the first publish, then frozen. */
  slug: slugId,
  format: z.enum(POST_FORMATS).default("article"),
  title: line(90),
  excerpt: longText(220),
  cover: MediaRefSchema,
  category: z.enum(POST_CATEGORIES),
  programmeIds: z.array(z.enum(PROGRAMME_IDS)).max(6).default([]),
  causeSlugs: z.array(slugId).max(6).default([]),
  /** Countries only, never towns (§15). */
  countries: z.array(placeSchema).max(10).default([]),
  tags: z.array(line(32)).max(10).default([]),
  body: BlocksSchema.default([]),
  /** The byline is a staff choice; AI is never the byline. */
  author: z.object({ uid: uid.optional(), displayName: line(60), role: line(60).optional(), avatar: MediaRefSchema.optional() }),
  status: z.enum(POST_STATUSES).default("draft"),
  publishAt: millis.optional(),
  publishedAt: millis.optional(),
  featured: z.boolean().default(false),
  review: z
    .object({
      submittedBy: uid.optional(),
      submittedAt: millis.optional(),
      reviewer: uid.optional(),
      reviewedAt: millis.optional(),
      notes: longText(1000).optional(),
      checklist: ReviewChecklistSchema,
    })
    .prefault({}),
  origin: PostOriginSchema,
  seo: SeoSchema,
  readingMinutes: z.number().int().min(1).max(120).default(1),
});

/**
 * What the AI writer (and any import) may produce: the public fields only. Status, review, origin
 * and dates are always set by the server (createAiDraft). Used with z.toJSONSchema() for structured output.
 */
export const PostDraftSchema = z.object({
  slug: slugId.optional(),
  format: z.enum(POST_FORMATS).default("article"),
  title: line(90),
  excerpt: longText(220),
  cover: MediaRefSchema.optional(),
  category: z.enum(POST_CATEGORIES),
  programmeIds: z.array(z.enum(PROGRAMME_IDS)).max(6).default([]),
  causeSlugs: z.array(slugId).max(6).default([]),
  countries: z.array(placeSchema).max(10).default([]),
  tags: z.array(line(32)).max(10).default([]),
  body: BlocksSchema.min(1, { error: "The draft needs at least one paragraph." }),
});

export const PolicySchema = z.object({
  slug: z.enum(POLICY_SLUGS),
  title: line(60),
  /** "In plain words" bullets. */
  summary: z.array(line(200)).min(1).max(6),
  body: BlocksSchema,
  version: line(20),
  effectiveFrom: isoDate,
  /** The "Draft, pending professional review" banner shows while the reviewer is not professional (D50). */
  lastReview: z.object({ by: line(80), reviewer: z.enum(["internal", "professional"]), at: millis }).optional(),
  pdf: MediaRefSchema.optional(),
  seo: SeoSchema,
});

/** A media asset (content-model §6.1 + D53). Pipeline ids are built in code; uploads are stored. */
export const MediaAssetSchema = z.object({
  /** Pipeline id ("hero-family-in") or "up-…" for uploads; an upload may reuse a pipeline id to replace it. */
  id: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/),
  kind: z.enum(["image", "video", "document"]),
  source: z.enum(["pipeline", "upload"]),
  /** Pipeline: /media/… (hashed). Upload: /m/public/media/{id}/{sha256-12}.webp. */
  src: z.string().min(1).max(500),
  poster: z.string().max(500).optional(),
  /** Uploads: the BlobStore key (public/media/…). */
  storageKey: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().min(0).optional(),
  hash: z.string().max(64).optional(),
  blurDataURL: z.string().max(4000).optional(),
  /** Required unless decorative. */
  alt: z.string().max(240).default(""),
  decorative: z.boolean().default(false),
  /** Percent 0–100, → object-position. */
  focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  caption: z.string().max(240).optional(),
  credit: z.string().max(120).optional(),
  safeguarding: z.object({
    peopleVisible: z.boolean(),
    childInImage: z.boolean(),
    /** Faces recognisable. */
    identifiable: z.boolean(),
    aiGenerated: z.boolean(),
    /** Illustrative; to be replaced before launch (HANDOFF). */
    placeholder: z.boolean().default(false),
    /** Covers everyone identifiable in the frame. */
    consent: ConsentSchema,
    /** True for every upload (EXIF/GPS removed by sharp). */
    metadataStripped: z.boolean().default(true),
    /** "Could someone recognise exactly where this is?" */
    locationRisk: z.enum(["no", "yes", "unsure"]).default("no"),
  }),
  status: z.enum(["active", "archived", "withdrawn"]).default("active"),
  uploadedBy: uid.optional(),
  uploadedAt: millis.optional(),
  updatedBy: uid.optional(),
  updatedAt: millis.optional(),
});
export type MediaAsset = z.output<typeof MediaAssetSchema>;
export type MediaAssetInput = z.input<typeof MediaAssetSchema>;

/** D57: the annual "where the money went" summary (id `fy-YYYY`). Never summed across currencies. */
export const AllocationSummarySchema = z.object({
  order,
  label: line(60),
  periodStart: isoDate,
  periodEnd: isoDate,
  byCurrency: z
    .partialRecord(
      z.enum(CURRENCIES),
      z.object({
        received: z.number().min(0),
        lines: z
          .array(z.object({ key: z.union([z.enum(PROGRAMME_IDS), z.enum(["admin", "fees", "other"])]), label: line(60), amount: z.number().min(0), tone: z.enum(BRAND_TONES).optional() }))
          .max(12),
      }),
    )
    .default({}),
  verification: VerificationSchema,
  /** The annual report in the library. */
  reportResourceSlug: slugId.optional(),
  note: longText(300).optional(),
});

/* ── Registries of schemas ─────────────────────────────────────────────── */

export const DocSchemas = {
  "settings.site": SiteSettingsSchema,
  "settings.contact": ContactSettingsSchema,
  "settings.safety": SafetySettingsSchema,
  "settings.announcements": AnnouncementsSchema,
  "settings.chrome": ChromeSettingsSchema,
  "settings.seo": SeoSettingsSchema,
  "settings.editorial": EditorialSettingsSchema,
  "home.layout": HomeLayoutSchema,
  "home.hero": HomeHeroSchema,
  "home.world": HomeWorldSchema,
  "home.partners": HomePartnersSchema,
  "home.programmes": HomeProgrammesSchema,
  "home.about": HomeAboutSchema,
  "home.duo": HomeDuoSchema,
  "home.manifesto": HomeManifestoSchema,
  "home.impact": HomeImpactSchema,
  "home.focus": HomeFocusSchema,
  "home.appeals": HomeAppealsSchema,
  "home.donate": HomeDonateSchema,
  "home.doors": HomeDoorsSchema,
  "home.stories": HomeStoriesSchema,
  "home.founder": HomeFounderSchema,
  "home.team": HomeTeamSchema,
  "home.restoring": HomeRestoringSchema,
  "home.testimonials": HomeTestimonialsSchema,
  "home.journey": HomeJourneySchema,
  "home.projects": HomeProjectsSchema,
  "home.faq": HomeFaqSchema,
  "home.join": HomeJoinSchema,
  "home.news": HomeNewsSchema,
  "home.finalCta": HomeFinalCtaSchema,
  "donate.config": DonateConfigSchema,
  "pages.about": PageDocSchema,
  "pages.programmes": PageDocSchema,
  "pages.getSupport": PageDocSchema,
  "pages.requestSupport": PageDocSchema,
  "pages.reportConcern": PageDocSchema,
  "pages.contact": PageDocSchema,
  "pages.resources": PageDocSchema,
  "pages.requestReport": PageDocSchema,
  "pages.impact": PageDocSchema,
  "pages.projects": PageDocSchema,
  "pages.stories": PageDocSchema,
  "pages.shareStory": PageDocSchema,
  "pages.news": PageDocSchema,
  "pages.getInvolved": PageDocSchema,
  "pages.volunteer": PageDocSchema,
  "pages.partner": PageDocSchema,
  "pages.sponsor": PageDocSchema,
  "pages.donate": PageDocSchema,
  "pages.thankYou": PageDocSchema,
  "pages.faq": PageDocSchema,
  "pages.policies": PageDocSchema,
  "pages.search": PageDocSchema,
  "pages.privacyRequest": PageDocSchema,
  "pages.notFound": PageDocSchema,
} as const satisfies Record<DocId, z.ZodType>;

export const ItemSchemas = {
  programmes: ProgrammeSchema,
  causes: CauseSchema,
  stats: StatSchema,
  stories: StorySchema,
  testimonials: TestimonialSchema,
  team: TeamMemberSchema,
  faqs: FaqSchema,
  partners: PartnerSchema,
  projects: ProjectSchema,
  posts: PostSchema,
  policies: PolicySchema,
  media: MediaAssetSchema,
  allocationSummaries: AllocationSummarySchema,
} as const satisfies Record<CollectionName, z.ZodType>;

/** The parsed (output) shape of a singleton. */
export type DocData<K extends DocId> = z.output<(typeof DocSchemas)[K]>;
/** What may be written for a singleton (defaults filled on parse). */
export type DocInput<K extends DocId> = z.input<(typeof DocSchemas)[K]>;
/** The parsed (output) shape of a collection item, without the record id. */
export type Item<C extends CollectionName> = z.output<(typeof ItemSchemas)[C]>;
/** What may be written for a collection item. */
export type ItemInput<C extends CollectionName> = z.input<(typeof ItemSchemas)[C]>;

/** Collections with the draft/published envelope (media assets are stored as plain records). */
export type EnvelopedCollection = Exclude<CollectionName, "media">;

export type Programme = Item<"programmes">;
export type Cause = Item<"causes">;
export type Stat = Item<"stats">;
export type Story = Item<"stories">;
export type Testimonial = Item<"testimonials">;
export type TeamMember = Item<"team">;
export type Faq = Item<"faqs">;
export type Partner = Item<"partners">;
export type Project = Item<"projects">;
export type Post = Item<"posts">;
export type PostDraftInput = z.input<typeof PostDraftSchema>;
export type Policy = Item<"policies">;
export type AllocationSummary = Item<"allocationSummaries">;
export type PostStatus = Post["status"];

/* ── Stored record envelope (D31) ──────────────────────────────────────── */

/**
 * Every content singleton (siteContent/{docId}) and collection item ({collection}/{id}) is stored in
 * this envelope. `version` is the only concurrency control (no edit locks); the previous published
 * value is snapshotted to the `versions` subcollection on publish (keep 20).
 */
export type StoredRecord<T> = {
  id: string;
  published: T | null;
  draft: T | null;
  version: number;
  /** Collections only; singletons are always "live". */
  visibility: Visibility;
  /** Seeded from a // CLIENT value; cleared when staff confirm it. */
  placeholder?: boolean;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  publishedAt?: number;
  publishedBy?: string;
};

export const StoredRecordSchema = z.object({
  published: z.unknown().nullable().default(null),
  draft: z.unknown().nullable().default(null),
  version: z.number().int().min(0).default(0),
  visibility: z.enum(VISIBILITIES).default("live"),
  placeholder: z.boolean().optional(),
  createdAt: millis.default(0),
  createdBy: z.string().default("seed"),
  updatedAt: millis.default(0),
  updatedBy: z.string().default("seed"),
  publishedAt: millis.optional(),
  publishedBy: z.string().optional(),
});

/** Currency helper for schema consumers (typed tuple order). */
export const CURRENCY_ORDER: readonly Currency[] = CURRENCIES;
