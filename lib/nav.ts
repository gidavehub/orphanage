// Public navigation as code (PLAN D24, D126; public-pages §5.1 and §5.6; design-system §4.2).
// Programme links are derived from the programmes collection, so the server builds the menus and
// passes plain data to the client Header. `match` is a list of path prefixes (functions cannot cross
// from the server to a client component).

import type { ProgrammeId, ProgrammeSlug } from "@/lib/model/enums";
import type { SearchHitType } from "@/lib/content/search";
import { routes, type PolicySlug } from "@/lib/routes";

export type NavIcon = ProgrammeId | "shield" | "book" | "heart" | "users" | "file";

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  icon?: NavIcon;
  /** Report a Concern: coral-800 disc and label. */
  urgent?: boolean;
  /** "Administrator Login" is rel="nofollow". */
  rel?: "nofollow";
};

export type NavFeature = {
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string };
  tone: "forest" | "deep" | "clay";
  image?: string;
};

export type NavItem = {
  label: string;
  /** Used at 1280–1399px so the pill still fits. */
  short?: string;
  /** A real route: the label itself navigates. */
  href: string;
  /** Used instead of href only when the current page is "/". */
  homeAnchor?: string;
  /** Path prefixes that make this item active. Default: [href]. "/" matches only the home page. */
  match?: string[];
  /** Simple dropdown. */
  children?: NavLink[];
  /** Mega panel (only Programmes, D126): link columns, a feature card and a bottom row. */
  mega?: {
    columns: { title?: string; links: NavLink[] }[];
    feature?: NavFeature;
    /** The bottom row: "All programmes →" on the left, quick actions (Report a Concern) on the right. */
    footer?: { link: NavLink; actions?: NavLink[] };
  };
};

export type NavProgramme = { id: ProgrammeId; slug: ProgrammeSlug; title: string; navBlurb: string };
export type NavPolicy = { slug: string; title: string };

function programmeLinks(programmes: NavProgramme[]): NavLink[] {
  return programmes.map((p) => ({ label: p.title, href: routes.programme(p.slug), description: p.navBlurb, icon: p.id }));
}

/** The header's main navigation. "Donate Now" is the separate marigold pill → /donate. */
export function buildMainNav(programmes: NavProgramme[]): NavItem[] {
  return [
    { label: "Home", href: "/", homeAnchor: "#top", match: ["/"] },
    {
      label: "About Us",
      short: "About",
      href: routes.about(),
      match: ["/about"],
      children: [
        { label: "Who We Are", href: routes.about() },
        { label: "How We Work", href: routes.about("approach") },
        { label: "Our Team", href: routes.about("team") },
        { label: "Our Partners", href: routes.about("partners") },
      ],
    },
    {
      label: "Our Programmes",
      short: "Programmes",
      href: routes.programmes(),
      match: ["/programmes"],
      children: programmeLinks(programmes),
      mega: {
        columns: [{ links: programmeLinks(programmes) }],
        feature: {
          eyebrow: "Need help now?",
          title: "Not sure which programme fits?",
          text: "Tell us what's happening and our team will guide you to the right support.",
          cta: { label: "Request Support", href: routes.request() },
          tone: "forest",
        },
        footer: {
          link: { label: "All programmes", href: routes.programmes() },
          actions: [{ label: "Report a Concern", href: routes.concern(), icon: "shield", urgent: true }],
        },
      },
    },
    {
      label: "Get Support",
      href: routes.getSupport(),
      match: ["/get-support", "/report-a-concern", "/faq"],
      children: [
        { label: "Request Support", href: routes.request() },
        { label: "Report a Concern", href: routes.concern(), icon: "shield", urgent: true },
        { label: "How Support Works", href: routes.getSupport() },
        { label: "Questions & Answers", href: routes.faq() },
      ],
    },
    {
      label: "Resources",
      href: routes.resources(),
      match: ["/resources", "/request-a-report", "/policies"],
      children: [
        { label: "Resource Library", href: routes.resources() },
        { label: "Reports & Publications", href: routes.resources({ category: "annual_reports" }) },
        { label: "Request a Report", href: routes.requestReport() },
        { label: "Our Policies", href: routes.policies() },
      ],
    },
    {
      label: "Our Impact",
      short: "Impact",
      href: routes.impact(),
      match: ["/impact", "/projects", "/stories", "/news"],
      children: [
        { label: "Impact Overview", href: routes.impact() },
        { label: "Projects", href: routes.projects() },
        { label: "Stories of Hope", href: routes.stories() },
        { label: "News & Updates", href: routes.news() },
      ],
    },
    {
      label: "Get Involved",
      href: routes.involved(),
      match: ["/get-involved"],
      children: [
        { label: "Become a Volunteer", href: routes.volunteer() },
        { label: "Partner With Us", href: routes.partner() },
        { label: "Sponsorship", href: routes.sponsor() },
        { label: "Give in Kind", href: routes.donate(undefined, { mode: "in-kind" }) },
        { label: "Share Your Story", href: routes.shareStory() },
      ],
    },
    { label: "Contact", href: routes.contact(), match: ["/contact"] },
  ];
}

const POLICY_FOOTER_LABEL: Record<PolicySlug, string> = {
  safeguarding: "Child Safeguarding Policy",
  privacy: "Privacy Policy",
  terms: "Terms of Use",
};
const DEFAULT_POLICIES: NavPolicy[] = [
  { slug: "safeguarding", title: POLICY_FOOTER_LABEL.safeguarding },
  { slug: "privacy", title: POLICY_FOOTER_LABEL.privacy },
  { slug: "terms", title: POLICY_FOOTER_LABEL.terms },
];

/** Footer link columns (public-pages §5.6). */
export function buildFooterLinks(
  programmes: NavProgramme[],
  policies: NavPolicy[],
): { quick: NavLink[]; programmes: NavLink[]; legal: NavLink[] } {
  const policyList = policies.length ? policies : DEFAULT_POLICIES;
  return {
    quick: [
      { label: "About Us", href: routes.about() },
      { label: "Our Impact", href: routes.impact() },
      { label: "Stories of Hope", href: routes.stories() },
      { label: "News & Updates", href: routes.news() },
      { label: "Resources & Reports", href: routes.resources() },
      { label: "Get Involved", href: routes.involved() },
      { label: "Contact Us", href: routes.contact() },
    ],
    programmes: programmes.map((p) => ({ label: p.title, href: routes.programme(p.slug) })),
    legal: [
      ...policyList.map((p) => ({
        label: POLICY_FOOTER_LABEL[p.slug as PolicySlug] ?? p.title,
        href: `/policies/${encodeURIComponent(p.slug)}`,
      })),
      { label: "Report a Concern", href: routes.concern() },
      { label: "Request a Report", href: routes.requestReport() },
      { label: "FAQs", href: routes.faq() },
      { label: "Administrator Login", href: routes.admin.home, rel: "nofollow" },
    ],
  };
}

/** The persistent marigold "Donate Now" pill, marked current on every /donate page. */
export const DONATE_NAV: NavItem = { label: "Donate Now", href: routes.donate(), match: ["/donate"] };

/** Search suggestion chips → routes (public-pages §3.22). Their labels are editable in pages.search. */
export const SEARCH_SUGGESTIONS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Request support", href: routes.request() },
  { label: "School-fee assistance", href: routes.programme("education") },
  { label: "Counselling", href: routes.programme("counselling") },
  { label: "Report a concern", href: routes.concern() },
  { label: "Volunteer", href: routes.volunteer() },
  { label: "Annual report", href: routes.resources({ category: "annual_reports" }) },
];

/** Group headings for search results (overlay and /search), in the plural. */
export const SEARCH_TYPE_LABEL: Record<SearchHitType, string> = {
  programme: "Programmes",
  page: "Pages",
  cause: "Ways to give",
  resource: "Resources",
  news: "News",
  story: "Stories",
  project: "Projects",
  faq: "Questions",
};

/** One short noun per type, for screen readers ("Programme: Education Assistance"). */
export const SEARCH_TYPE_SINGULAR: Record<SearchHitType, string> = {
  programme: "Programme",
  page: "Page",
  cause: "Way to give",
  resource: "Resource",
  news: "News",
  story: "Story",
  project: "Project",
  faq: "Question",
};

/**
 * Whether a menu link IS the current page (aria-current="page" in dropdowns and the mobile menu).
 * Only plain paths count: hash and query links ("/about#team", "/resources?category=…") never do,
 * so one page never marks two rows.
 */
export function isCurrentHref(href: string, pathname: string | null | undefined): boolean {
  if (!pathname || /[?#]/.test(href)) return false;
  return href === (pathname.split(/[?#]/, 1)[0] || "/");
}

function matchesPrefix(prefix: string, pathname: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Active-state rule for a top-level item. */
export function isActive(item: NavItem, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  const prefixes = item.match?.length ? item.match : [item.href.split(/[?#]/, 1)[0]];
  return prefixes.some((p) => matchesPrefix(p, path));
}
