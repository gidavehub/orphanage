// Policies (content-model §3.5, PLAN D50; public-pages §3.21). Three drafts with every required
// heading and short [draft] text under each. CLIENT: the organisation's legal drafter must review and
// replace this text (ToR §15 "Professional review of policies"). `lastReview.reviewer` is "internal",
// so every page shows the "Draft, pending professional review" banner until a professional review
// is recorded.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";

type B = ItemSeed<"policies">["body"][number];

let n = 0;
const h = (text: string): B => ({ id: `h${++n}`, type: "heading", level: 2, text });
const p = (text: string): B => ({ id: `p${++n}`, type: "paragraph", text });
const ul = (items: string[]): B => ({ id: `l${++n}`, type: "list", style: "bullet", items });

const DRAFT_REVIEW = { by: "Haven team", reviewer: "internal" as const, at: Date.UTC(2026, 9, 1, 9) };

const safeguardingBody: B[] = [
  h("Our commitment"),
  p("Haven exists to protect children. Every child has the right to be safe, and the safety and best interests of children come first in everything we do."),
  h("Every child, equally"),
  p("Every child has the same right to protection and support, whatever their nationality, race, ethnicity, religion or belief, language, disability, gender or family background, and wherever they come from. We act on every concern about any child, and we decide how to help by a child's needs and safety alone."),
  h("Who this policy applies to"),
  p("This policy applies to our trustees, staff, volunteers, contractors and anyone who represents Haven, in person and online."),
  h("Definitions"),
  p("A child is anyone under the age of 18. Safeguarding means protecting children from abuse, neglect and exploitation, and acting when we are worried about a child."),
  h("Safe recruitment and volunteer checks"),
  p("Everyone who works with children is recruited safely: we check identity and references, carry out background checks where the law allows, and provide safeguarding training before they begin."),
  h("Code of conduct"),
  p("Our people treat every child with respect, never spend time alone with a child out of sight of others, never contact children privately, and report any concern straight away."),
  h("Consent for images and stories"),
  p("We never publish a child's image or story without written consent from a parent or guardian. We never publish children's full names or precise locations."),
  h("Online safety"),
  p("We keep children's information secure, limit who can see it by role, and never share children's details on social media."),
  h("How to report a concern"),
  p("If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority immediately. Otherwise, use our confidential [concern form](/report-a-concern)."),
  h("How we respond"),
  ul([
    "Your report is sent securely.",
    "Authorised safeguarding staff are alerted.",
    "It is reviewed and given a risk level.",
    "Urgent cases are escalated.",
    "Services or authorities are contacted.",
    "Every action is recorded.",
  ]),
  h("Designated Safeguarding Officer"),
  p("Haven has a designated safeguarding officer who receives every concern and decides on the response. Only approved safeguarding personnel can see reports."),
  h("Partner institutions"),
  p("We expect partner organisations, schools and children's homes to have safeguarding arrangements of their own, and we help them put these in place."),
  h("Review"),
  p("This policy is reviewed every year, and after any serious incident, by our safeguarding lead and a qualified professional."),
];

const privacyBody: B[] = [
  h("Who we are"),
  p("Haven is the public name of The Orphanage Project. We are responsible for the personal information you share with us through this website."),
  h("What we collect"),
  ul([
    "Support requests: your name, contact details, country, relationship to the child and a short explanation of what is happening.",
    "Concern reports: what you tell us about a child's safety, and your contact details unless you stay anonymous.",
    "Donations: your name, email, country and the details of your gift. We never store card details.",
    "Volunteer, partnership, contact and report requests: the details you enter in each form.",
    "Newsletter: your email address and your consent.",
  ]),
  h("Why and on what basis"),
  p("We use your information only to respond to you, to provide or arrange support, to keep children safe, to process gifts and receipts, and to meet our legal duties."),
  h("Who can see it"),
  p("Access is restricted by role. For example, concern reports can only be seen by approved safeguarding staff, and donation records only by our finance team."),
  h("Children's information"),
  p("We collect as little as possible about children, never publish their names or precise locations, and protect their records with the strictest access controls."),
  h("Payments"),
  p("Card payments are processed by Stripe on its secure page. We never store card details on this site."),
  h("Cookies"),
  p("This website uses only essential cookies. Our visitor statistics are cookieless."),
  h("Processors and international transfers"),
  p("We use trusted services to run the website and our records: Google Firebase, Stripe, Vercel, our email provider and Zoom. Some of them store information outside The Gambia, under contracts that protect it."),
  h("Retention periods"),
  ul([
    "Support requests that did not lead to support: 2 years after closure.",
    "Support requests that led to support: 7 years after closure, then reviewed.",
    "Safeguarding concerns: at least 7 years after closure, and always reviewed by our safeguarding officer before deletion.",
    "Donation and receipt records: 7 years after the end of the financial year, then your personal details are removed.",
    "Contact messages and report requests: 2 years after closure.",
    "Unconfirmed newsletter sign-ups: 30 days.",
  ]),
  h("Security"),
  p("The site is encrypted with HTTPS, staff sign in with strong passwords and a second step where their role requires it, every access to sensitive records is logged, and backups are kept securely."),
  h("Your rights: correct or delete"),
  p("You can ask us to show you, correct or delete the information we hold about you, or to stop contacting you. Use our [privacy request form](/privacy/request) and we will reply within 30 days."),
  p("Some records must be kept for a time by law, such as gift receipts and safeguarding reports. When that applies, we restrict them, stop all contact and tell you why. Deleted information is removed from our backups within 100 days, as old backups are replaced."),
  h("Contact"),
  p("For any question about your information, contact our team through the [contact page](/contact)."),
  h("Changes"),
  p("We will update this policy when our practices change, and show the date of the latest version at the top of this page."),
];

const termsBody: B[] = [
  h("Using this site"),
  p("This website explains Haven's work and lets you ask for support, report a concern, give and get involved. Please use it honestly and lawfully."),
  h("Not an emergency service"),
  p("If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority immediately. Do not wait for a response from this website."),
  h("No medical or legal advice"),
  p("We do not provide medical diagnoses or replace professional medical advice. General website information is not legal advice."),
  h("Donations, receipts, refunds and recurring cancellation"),
  p("Every gift is acknowledged and receipted. You can change or cancel a monthly gift at any time, and ask us about a refund if something went wrong."),
  h("Submissions and accuracy"),
  p("Please give accurate information. Because of fraud, all information is checked and verified, and submitting a request does not guarantee support."),
  h("Content and copyright"),
  p("The words, design and images on this site belong to Haven or are used with permission. Please ask before reusing them."),
  h("Illustrative imagery"),
  p("Some photographs on this site are illustrative and were created with AI tools. They do not show the children and families we support."),
  h("Liability"),
  p("We work hard to keep this site accurate and available, but we cannot promise it will always be error-free or uninterrupted."),
  h("Governing law"),
  p("These terms are governed by the laws named by Haven's legal advisers."),
  h("Contact"),
  p("Questions about these terms? Reach us through the [contact page](/contact)."),
];

export const policySeeds: ItemSeed<"policies">[] = [
  {
    id: "safeguarding",
    placeholder: true,
    slug: "safeguarding",
    title: "Child Safeguarding Policy",
    summary: [
      "Children's safety and best interests come first in everything we do.",
      "Everyone who works with children is checked and trained before they begin.",
      "We never publish a child's image or story without written consent from a parent or guardian.",
      "Any concern goes straight to our designated safeguarding officer.",
    ],
    body: safeguardingBody,
    version: "0.1",
    effectiveFrom: "2026-10-01",
    lastReview: DRAFT_REVIEW,
    seo: {},
  },
  {
    id: "privacy",
    placeholder: true,
    slug: "privacy",
    title: "Privacy Policy",
    summary: [
      "We only collect the information we need to help you.",
      "Only authorised staff can see your information, depending on their role.",
      "We never store card details on this site.",
      "You can ask us to correct or delete your information.",
    ],
    body: privacyBody,
    version: "0.1",
    effectiveFrom: "2026-10-01",
    lastReview: DRAFT_REVIEW,
    seo: {},
  },
  {
    id: "terms",
    placeholder: true,
    slug: "terms",
    title: "Terms of Use",
    summary: [
      "This website is not an emergency service.",
      "Website information is not medical or legal advice.",
      "Submitting a request does not guarantee support.",
      "Some images are illustrative and were created with AI tools.",
    ],
    body: termsBody,
    version: "0.1",
    effectiveFrom: "2026-10-01",
    lastReview: DRAFT_REVIEW,
    seo: {},
  },
];
