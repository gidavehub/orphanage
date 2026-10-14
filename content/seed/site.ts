// Site-wide settings seeds (content-model §3.7, PLAN D51). Values verbatim from content/site.ts and
// the copy hard-coded in Footer.tsx / app/layout.tsx / app/opengraph-image.tsx today.
// Anything marked CLIENT is a placeholder the organisation must confirm (ToR §18); the matching
// doc ids are listed in PLACEHOLDER_DOCS so the Before-launch checklist can flag them.

import "server-only";

import type { DocSeed } from "@/lib/content/types";

export const siteSeed = {
  name: "Haven",
  orgName: "The Orphanage Project",
  foundedYear: 2010, // CLIENT: drives the "Years of Service" counter
  tagline: "Restoring Hope. Protecting Childhood. Building Futures.",
  altTagline: "Every Child Deserves Safety, Care and Opportunity.",
  description:
    "Haven protects vulnerable children and strengthens families by connecting them with education, healthcare, counselling, legal assistance and community-based support.",
  // CLIENT: confirm the wording. Shown wherever people ask for help or give (EveryChildNote).
  everyChild:
    "Haven helps every child, whatever their nationality, race, ethnicity, religion or belief, language, disability, gender or family background. We decide how to help by a child's needs and safety alone.",
  footerStatement: "Restoring Hope. Protecting Childhood.",
  signOff: "for every child.",
  // CLIENT: new copy, to confirm.
  illustrativeNotice: "Some photographs on this site are illustrative and do not show the children and families we support.",
  timeZone: "Africa/Banjul",
  registrations: [], // CLIENT: charity and NGO registration numbers
  figures: { hideUnverified: false },
} satisfies DocSeed<"settings.site">;

export const contactSeed = {
  addressLabel: "Our offices",
  offices: [
    { label: "The Gambia", address: "Kanifing, The Gambia" }, // CLIENT: full address and office phone
    { label: "United States", address: "California, USA" }, // CLIENT: full address and US office phone
  ],
  phoneLabel: "Call us any time",
  phone: "+220 000 0000", // CLIENT
  emailLabel: "Email us any time",
  email: "hello@haven.org.gm", // CLIENT
  socials: [
    { name: "Facebook", icon: "facebook", href: "#", show: true }, // CLIENT
    { name: "Instagram", icon: "instagram", href: "#", show: true }, // CLIENT
    { name: "TikTok", icon: "tiktok", href: "#", show: true }, // CLIENT
    { name: "X", icon: "x", href: "#", show: true }, // CLIENT
    { name: "YouTube", icon: "youtube", href: "#", show: true }, // CLIENT
    { name: "LinkedIn", icon: "linkedin", href: "#", show: true }, // CLIENT
  ],
  // CLIENT: the team mailboxes (PLAN §8 q7).
  teamEmails: {
    support: "support@haven.org.gm",
    safeguarding: "safeguarding@haven.org.gm",
    donations: "donations@haven.org.gm",
    partnerships: "partnerships@haven.org.gm",
    media: "media@haven.org.gm",
    privacy: "privacy@haven.org.gm",
  },
  hours: "Monday to Friday, 9:00 to 17:00 (The Gambia)", // CLIENT
  // CLIENT: reply times the team can keep.
  responseTimes: {
    support: "5 working days",
    contact: "3 working days",
    reportRequest: "10 working days",
    volunteer: "10 working days",
  },
} satisfies DocSeed<"settings.contact">;

/** The values a launch check compares against: still equal → still a placeholder (D130). */
export const CONTACT_SEED_VALUES = {
  phone: contactSeed.phone,
  email: contactSeed.email,
  socialHref: "#",
} as const;

export const safetySeed = {
  emergencyNotice:
    "If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority immediately. Do not wait for a response from this website.",
  footerHeading: "If a Child Is in Danger, Act Now",
  emergencyContacts: [], // CLIENT: verified local emergency and child-protection numbers per country
} satisfies DocSeed<"settings.safety">;

export const announcementsSeed = {
  ticker: [
    "Are you ready to help them? Let’s become a volunteer…",
    "Every child deserves a safe and hopeful future.",
    "Give in kind: school materials, clothing, food and medical supplies.",
    "Need help for a child? Submit a confidential request.",
    "Standing with children and families in every nation.",
    "Seasonal appeals: Ramadan, Eid, Christmas and Thanksgiving.",
  ],
} satisfies DocSeed<"settings.announcements">;

export const chromeSeed = {
  footerCtas: [
    { label: "Request Support", to: "support" },
    { label: "Report a Concern", to: "report" },
  ],
  donateCta: { label: "Donate Now", to: "donate" },
} satisfies DocSeed<"settings.chrome">;

export const seoSeed = {
  ogLines: ["Every child deserves", "a safe & hopeful future"],
} satisfies DocSeed<"settings.seo">;

export const editorialSeed = {
  aiDrafting: { enabled: true, dayOfMonth: 1 },
  topics: [],
  // CLIENT: the voice the monthly drafts should keep.
  voice:
    "Warm, plain and hopeful. Short sentences in British English. Lead with what changed for children and families, never with pity. Name programmes and countries, never children, villages or streets.",
  mustAvoid: [
    "Children's names",
    "Towns, villages, schools or streets",
    "Medical diagnoses or advice",
    "Legal advice",
    "Figures that are not verified",
    "Promises of support to any family",
  ],
  reviewerUids: [],
  length: "article",
} satisfies DocSeed<"settings.editorial">;
