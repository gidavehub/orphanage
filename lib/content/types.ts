// Content types and public view-models (content-model §3.2, §4.3; PLAN §5.3). Types only.
// Client components may `import type` from here; values come from lib/content/public.ts on the server.
//
// The view-models keep TODAY's prop shapes wherever possible (content-model §4.3): sections receive
// their slice as props and their JSX bodies stay untouched. Media arrives resolved (src, alt,
// illustrative); destinations arrive as hrefs.

import type { CollectionName, DocId, PageKey } from "./ids";
import type {
  AllocationPart,
  Block,
  BuiltinPartnerLogo,
  CardTone,
  CauseKind,
  CauseStatus,
  DocData,
  DocInput,
  FaqPlacement,
  Item,
  ItemInput,
  MediaRef,
  OptionalHomeSection,
  PageDoc,
  PolicySlug,
  PostCategory,
  PostFormat,
  ProgrammeNoticeKind,
  ProjectStatus,
  SocialIconName,
  StatKind,
  Visibility,
} from "./schema";
import type { Currency, Frequency, Millis, ProgrammeId, ProgrammeSlug } from "@/lib/model/enums";
import type { UiImage, UiVideo } from "@/lib/model/ui";
import type { NavItem, NavLink } from "@/lib/nav";
import type { RouteKey } from "@/lib/routes";

export type { DocId, CollectionName, PageKey } from "./ids";
export type { DocData, DocInput, Item, ItemInput, MediaRef, Block, PageDoc, Visibility } from "./schema";

/* ── Seeds ─────────────────────────────────────────────────────────────── */

/** One seeded collection item: its data plus the record id and envelope hints. */
export type ItemSeed<C extends CollectionName> = ItemInput<C> & {
  id: string;
  /** Seeded from a // CLIENT value (shown in the Before-launch checklist until confirmed). */
  placeholder?: boolean;
  /** Default "live". */
  visibility?: Visibility;
};

export type DocSeed<K extends DocId> = DocInput<K>;

/* ── Resolved media (content-model §3.2, PLAN §5.3) ────────────────────── */

/** An image ready for next/image: UiImage plus the asset id it came from. */
export type ResolvedImage = UiImage & {
  type: "image";
  assetId: string;
  /** "50% 30%" from the asset's focal point. */
  objectPosition?: string;
  /** AI-generated and shows people: render the "Illustrative image" credit (D54). */
  illustrative: boolean;
};

export type ResolvedVideo = UiVideo & {
  type: "video";
  assetId: string;
  alt: string;
  illustrative: boolean;
};

export type ResolvedDocument = { type: "document"; assetId: string; src: string; title: string };

export type ResolvedMedia = ResolvedImage | ResolvedVideo | ResolvedDocument;

/** Any content value with every MediaRef replaced by its resolved media. Keeps tuples. */
export type Resolved<T> = T extends MediaRef
  ? ResolvedMedia
  : T extends readonly unknown[]
    ? { [K in keyof T]: Resolved<T[K]> }
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T;

/** A stat from the registry, with its placeholder flag computed (D45–D46). */
export type ResolvedStat = {
  id: string;
  label: string;
  value: number;
  suffix: string;
  note?: string;
  kind: StatKind;
  /** True until a permitted person verifies the figure (renders the "Illustrative" treatment). */
  placeholder: boolean;
  verified: boolean;
  asOf?: string;
  amounts?: Partial<Record<Currency, number>>;
  tone?: string;
};

/** A button or link destination from a stored Cta. */
export type CtaView = { label: string; href: string; to: RouteKey };

/* ── Collection view-models ────────────────────────────────────────────── */

export type ProgrammeCard = {
  id: ProgrammeId;
  slug: ProgrammeSlug;
  title: string;
  summary: string;
  /** The notice shown in italics on the card, when one is marked for the card. */
  notice?: string;
  navBlurb: string;
  href: string;
};

export type ProgrammeNoticeView = { kind: ProgrammeNoticeKind; tone: "emergency" | "info" | "disclaimer"; text: string };

/** A programme page (/programmes/[slug]), D40–D41. */
export type ResolvedProgramme = Omit<Resolved<Item<"programmes">>, "notices"> & {
  href: string;
  /** The programme's `kind: 'programme'` cause (same slug as the programme, D40). */
  causeSlug: ProgrammeSlug;
  notices: ProgrammeNoticeView[];
  cardNotice?: string;
  requestHref: string;
  donateHref: string;
  partnerHref: string;
  placeholder: boolean;
};

/** A cause with its derived money fields (D37–D39). */
export type CauseView = {
  id: string;
  slug: string;
  kind: CauseKind;
  title: string;
  eyebrow?: string;
  season: string;
  groupId: string;
  programmeId?: ProgrammeId;
  programmeSlug?: ProgrammeSlug;
  place?: string;
  tone: CardTone;
  image: ResolvedImage;
  summary: string;
  story: Resolved<Block[]>;
  currency: Currency;
  /** Major units in the cause's currency. 0 = no goal. */
  goal: number;
  /** offlineRaised + online totals in the cause currency + converted contributions (D38), major units. */
  raised: number;
  /** raised / goal × 100 (unrounded); 0 without a goal. */
  percent: number;
  /** Online totals in other currencies (shown separately, never summed). */
  otherCurrencyTotals: Partial<Record<Currency, number>>;
  allocation: AllocationPart[];
  allocationAsOf?: string;
  impactUnits: Array<{ amount: number; currency: Currency; label: string }>;
  presetAmounts: Partial<Record<Currency, number[]>>;
  defaultFrequency: Frequency;
  allowedFrequencies: Frequency[];
  inKindItems: string[];
  zakatEligible: boolean;
  startsAt?: Millis;
  endsAt?: Millis;
  status: CauseStatus;
  /** Finance has verified the goal and breakdown. */
  verified: boolean;
  /** Seeded illustrative record (// CLIENT). */
  placeholder: boolean;
  /**
   * Whether money figures (raised, goal, percent, breakdown percentages) may be shown: verified
   * causes always; seeded placeholder causes until the before-launch switch hides unverified figures
   * (D38 + D46); other unverified causes never.
   */
  showFigures: boolean;
  /** Completed, or past endsAt. */
  closed: boolean;
  /** Active and inside its window. */
  live: boolean;
  href: string;
  seo: Item<"causes">["seo"];
};

/** The landing's appeal card (today's Appeals.tsx item shape plus slug and href). */
export type CauseCard = Pick<
  CauseView,
  "slug" | "title" | "season" | "groupId" | "place" | "currency" | "raised" | "goal" | "percent" | "image" | "tone" | "href" | "showFigures" | "verified" | "placeholder"
>;

export type StoryView = {
  id: string;
  label: string;
  meta: string;
  programmeId?: ProgrammeId;
  place: string;
  text: string;
  image: ResolvedImage;
  featured: boolean;
  placeholder: boolean;
};
export type ResolvedStory = StoryView;

export type TestimonialView = {
  id: string;
  name: string;
  kind: Item<"testimonials">["kind"];
  role: string;
  quote: string;
  image?: ResolvedImage;
  placeholder: boolean;
};

export type TeamMemberView = {
  id: string;
  name: string;
  role: string;
  image: ResolvedImage;
  socials: Array<{ icon: SocialIconName; href: string }>;
  bio: Resolved<Block[]>;
  languages: string[];
  showOn: Array<"home" | "about">;
  placeholder: boolean;
};

export type FaqView = { id: string; q: string; a: string; placements: FaqPlacement[]; locked: boolean };

export type PartnerView = {
  id: string;
  name: string;
  url?: string;
  /** A built-in placeholder badge (components/art/PartnerLogos.tsx) or an uploaded logo. */
  logo: { kind: "builtin"; key: BuiltinPartnerLogo } | { kind: "image"; image: ResolvedImage };
  placeholder: boolean;
};

export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: ResolvedImage;
  status: ProjectStatus;
  programmeId?: ProgrammeId;
  place?: string;
  causeSlug?: string;
  href: string;
};

export type ProjectView = Omit<Resolved<Item<"projects">>, "outcomes"> & {
  id: string;
  href: string;
  /** Verified outcomes only. */
  outcomes: Array<{ label: string; value: string }>;
  placeholder: boolean;
};

/** A post on cards, lists and RSS (content-model §7.5). */
export type PostCard = {
  id: string;
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  format: PostFormat;
  category: PostCategory;
  /** "Education", "Safeguarding", … */
  categoryLabel: string;
  /** "September 12, 2026" in the site's time zone. */
  dateLabel: string;
  publishedAt: Millis;
  cover: ResolvedImage;
  readingMinutes: number;
  featured: boolean;
};

export type ResolvedPost = Omit<Resolved<Item<"posts">>, "review" | "origin"> & {
  id: string;
  href: string;
  categoryLabel: string;
  dateLabel: string;
  /** AI-assisted: the byline box carries the transparency line. */
  aiAssisted: boolean;
  placeholder: boolean;
};

export type PolicyView = Resolved<Item<"policies">> & {
  id: string;
  slug: PolicySlug;
  href: string;
  /** The "Draft, pending professional review" banner (D50). */
  draft: boolean;
  lastReviewedLabel?: string;
  pdfHref?: string;
  placeholder: boolean;
};

export type AllocationSummaryView = Resolved<Item<"allocationSummaries">> & {
  id: string;
  verified: boolean;
  showFigures: boolean;
  placeholder: boolean;
};

export type PageView = Resolved<PageDoc> & { key: PageKey };

/* ── Settings view-models ──────────────────────────────────────────────── */

export type SiteSettingsView = DocData<"settings.site"> & {
  /** The current year (computed inside 'use cache', refreshed daily, D15). */
  year: number;
  yearsOfService: number;
};

export type ContactView = {
  addressLabel: string;
  /** "Kanifing, The Gambia · California, USA" (derived from offices). */
  address: string;
  offices: Array<{ label: string; address: string; phone?: string; phoneHref?: string; mapUrl?: string }>;
  phoneLabel: string;
  phone: string;
  /** "tel:" + digits (derived). */
  phoneHref: string;
  emailLabel: string;
  email: string;
  /** Only the links switched on. */
  socials: Array<{ name: string; icon: SocialIconName; href: string }>;
  teamEmails: DocData<"settings.contact">["teamEmails"];
  hours?: string;
  responseTimes: DocData<"settings.contact">["responseTimes"];
};

export type SafetyView = {
  emergencyNotice: string;
  footerHeading: string;
  /** Verified numbers only (D51). */
  emergencyContacts: Array<{ country: string; label: string; number: string }>;
};

/** Everything the site layout needs (Header, Footer, MobileMenu, footer notice). */
export type SiteChrome = {
  site: SiteSettingsView;
  contact: ContactView;
  safety: SafetyView;
  ticker: string[];
  ctas: { footer: [CtaView, CtaView]; donate: CtaView };
  nav: NavItem[];
  footerLinks: { quick: NavLink[]; programmes: NavLink[]; legal: NavLink[] };
  /** Any AI image with people visible is used by live content: show the footer notice (D54). */
  anyIllustrativeInUse: boolean;
  seo: { ogLines: [string, string]; ogImage?: ResolvedImage };
};

export type DonateConfigView = {
  defaultCurrency: Currency;
  /** Enabled currencies in display order. */
  currencies: Array<{ code: Currency; name: string; min: number; amounts: number[] }>;
  /** Enabled frequencies with their labels ("One-time", …). */
  frequencies: Array<{ value: Frequency; label: string }>;
  inKind: string[];
};

/* ── The landing page (content-model §4.3) ─────────────────────────────── */

export type HomeView = {
  /** Optional sections the content team switched off (G5). */
  hidden: OptionalHomeSection[];
  hero: {
    slides: Array<{ id: string; eyebrow: string; title: [string, string]; place: string; media: ResolvedImage | ResolvedVideo }>;
    text: string;
    primaryCta: CtaView;
    secondaryCta: CtaView;
  };
  world: { eyebrow: string; title: string; intro: string };
  partners: {
    /** ["Trusted by over", "45+", "partners & communities"] (today's shape). */
    title: [string, string, string];
    subline: string;
    stat: ResolvedStat | null;
    logos: PartnerView[];
  };
  programmes: { section: { eyebrow: string; lines: string[]; cardCta: string }; items: ProgrammeCard[] };
  about: {
    eyebrow: string;
    titleLines: string[];
    body: string[];
    values: Array<{ label: string; tone: "forest" | "marigold" | "flame" | "night" }>;
    visionLabel: string;
    vision: string;
    image: ResolvedImage;
    cta: CtaView;
  };
  duo: Array<{ title: string; text: string; cta: CtaView; tone: "forest" | "charcoal"; image: ResolvedImage }>;
  manifesto: { media: ResolvedVideo; tagline: string; ctas: [CtaView, CtaView] };
  impact: {
    title: string[];
    text: string;
    placeholderNote: string;
    showNote: boolean;
    stats: Array<{ id: string; label: string; value: number; suffix: string; note: string; tone: "clay" | "marigold" | "cocoa"; placeholder: boolean }>;
  };
  focus: { items: string[]; captions: string[]; media: Array<ResolvedImage | ResolvedVideo> };
  appeals: {
    section: { eyebrow: string; titleLines: string[]; intro: string; placeholderNote: string; groups: Array<{ id: string; label: string }> };
    causes: CauseCard[];
    showNote: boolean;
  };
  donate: {
    copy: {
      title: string[];
      text: string;
      media: ResolvedVideo;
      anywhereLabel: string;
      securityNote: string;
      thankYouCash: string;
      thankYouKind: string;
      updatesConsentLabel: string;
      anonymousLabel: string;
    };
    config: DonateConfigView;
    /** Seasonal and special appeals offered in the "preferred programme" select. */
    causes: Array<{ slug: string; title: string; currency: Currency }>;
    programmes: Array<{ id: ProgrammeId; slug: ProgrammeSlug; title: string }>;
  };
  doors: { title: string; text: string; primaryCta: CtaView; secondaryCta: CtaView; emergencyNotice: string };
  stories: { section: { title: string[]; intro: string; ctas: [CtaView, CtaView] }; items: StoryView[] };
  founder: {
    eyebrow: string;
    titleLines: string[];
    text: string;
    quoteName: string;
    quoteRole: string;
    quote: string;
    image: ResolvedImage;
    cta: CtaView;
    yearsOfService: number;
  };
  team: { section: { eyebrow: string; lines: string[]; intro?: string }; members: TeamMemberView[] };
  restoring: {
    titleLines: string[];
    text: string;
    stats: Array<{ id: string; label: string; value: number; suffix: string; tone: "marigold" | "white"; placeholder: boolean }>;
    showNote: boolean;
    placeholderNote: string;
    image: ResolvedImage;
    film: ResolvedVideo;
    filmTitle: string;
  };
  testimonials: { section: { eyebrow: string; lines: string[]; intro?: string }; items: TestimonialView[] };
  journey: { title: string; text: string; steps: Array<{ id: string; title: string; text: string; image: ResolvedImage }> };
  projects: { section: { eyebrow: string; lines: string[]; cta: CtaView }; items: ProjectCard[] };
  faq: {
    section: { eyebrow: string; lines: string[]; media: { main: ResolvedImage; inset: ResolvedImage; heart: ResolvedImage } };
    items: FaqView[];
  };
  join: { title: [string, string, string]; text: string; media: ResolvedVideo; note: string };
  news: { section: { eyebrow: string; lines: string[]; intro: string; cardCta: string }; posts: PostCard[] };
  /** D128: hidden by default (owner question). */
  finalCta: { visible: boolean; title: string; text?: string; buttons: CtaView[] };
};

/* ── Admin-facing helpers ──────────────────────────────────────────────── */

/** Where a content write targets. */
export type RecordKey = { kind: "doc"; id: DocId } | { kind: "item"; collection: CollectionName; id: string };

/** One entry of a record's "Earlier versions" list. */
export type VersionMeta = { version: number; by: string; at: Millis; note?: string };

