// Landing page seeds, one per home.* doc (content-model §3.7). Values verbatim from content/home.ts,
// content/site.ts and the copy hard-coded in components/sections/* today, so the landing renders
// exactly as before. CTAs point at RouteKeys, which resolve to the final page URLs (PLAN D25).
// Media are references by pipeline id (lib/media/pipeline.ts ref()).

import "server-only";

import type { DocSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

// Families from the poorest regions (user brief 2026-10-02): Africa, South and Southeast Asia and the
// Arab world, about a third Black; each a mother and a father with their children (founder).
export const homeLayoutSeed = {
  hidden: [],
} satisfies DocSeed<"home.layout">;

export const homeHeroSeed = {
  slides: [
    {
      id: "welcome",
      eyebrow: "Welcome to Haven",
      title: ["Every Child Deserves", "a Safe and Hopeful Future"],
      place: "gm",
      media: ref("hero-1"),
    },
    {
      id: "every-family",
      eyebrow: "Every Family, Every Nation",
      title: ["Standing With Families", "Wherever They Call Home"],
      place: "in",
      media: ref("hero-family-in"),
    },
    {
      id: "restoring-hope",
      eyebrow: "Restoring Hope",
      title: ["Restoring Hope", "One Child at a Time"],
      place: "ph",
      media: ref("hero-family-ph"),
    },
    {
      id: "give-hope",
      eyebrow: "Give Hope, Create Opportunity",
      title: ["Your Support Can Change", "a Child’s Story"],
      place: "et",
      media: ref("hero-family-et"),
    },
    {
      id: "stronger-together",
      eyebrow: "Stronger Together",
      title: ["Strong Families,", "Brighter Futures"],
      place: "pk",
      media: ref("hero-family-pk"),
    },
    {
      id: "protecting-childhood",
      eyebrow: "Protecting Childhood",
      title: ["Protecting Childhood", "Around the World"],
      place: "kh",
      media: ref("hero-family-kh"),
    },
    {
      id: "every-child",
      eyebrow: "Every Child, Everywhere",
      title: ["One Promise of Care", "for Every Child"],
      place: "ye",
      media: ref("hero-family-ye"),
    },
  ],
  text: "Haven stands with children and families of every background, in The Gambia and around the world, connecting them with education, healthcare, counselling, legal assistance and other essential support.",
  primaryCta: { label: "Support a Child", to: "donate" },
  secondaryCta: { label: "Request Support", to: "support" },
} satisfies DocSeed<"home.hero">;

export const homeWorldSeed = {
  eyebrow: "One Family, Every Nation",
  title: "Standing With Children and Families of Every Background",
  intro: "From The Gambia across Africa, South and Southeast Asia, the Arab world and beyond, every child deserves a safe and hopeful future.",
} satisfies DocSeed<"home.world">;

export const homePartnersSeed = {
  before: "Trusted by over",
  statId: "community-partners",
  after: "partners & communities",
  subline: "Organisations and communities we work with across borders.",
} satisfies DocSeed<"home.partners">;

export const homeProgrammesSeed = {
  eyebrow: "Our Programmes",
  lines: ["We Do It For Every Child", "Care That Reaches Every Need"],
  cardCta: "Learn More",
} satisfies DocSeed<"home.programmes">;

export const homeAboutSeed = {
  eyebrow: "About Haven",
  titleLines: ["Restoring Hope", "One Child at a Time"],
  body: [
    "Every child deserves to grow up feeling safe, valued and supported. Yet many children and families experience circumstances that limit their access to education, healthcare, protection and emotional support.",
    "Haven brings individuals, professionals, organisations and communities together to provide practical and sustainable assistance, helping children and families build safer, healthier and more hopeful futures. Rooted in The Gambia, we reach out to children and families wherever the need is.",
  ],
  values: [
    { label: "Child-centred", tone: "forest" },
    { label: "Compassion", tone: "marigold" },
    { label: "Integrity", tone: "flame" },
    { label: "Confidentiality", tone: "night" },
  ],
  visionLabel: "Our vision:",
  vision: "A society in which every child grows up safe, supported and able to reach their full potential.",
  image: ref("about"),
  cta: { label: "More About Us", to: "about" }, // public-pages §6: relabelled from "About More"
} satisfies DocSeed<"home.about">;

export const homeDuoSeed = {
  cards: [
    {
      title: "Become a Volunteer",
      text: "Contribute professional skills, time or community support: outreach, education, counselling, medical, legal, fundraising and more.",
      cta: { label: "Learn More", to: "volunteer" },
      tone: "forest",
      image: ref("duo-volunteer"),
    },
    {
      title: "Partner With Us",
      text: "Support programmes through institutional partnerships, corporate sponsorship, technical assistance or research collaboration.",
      cta: { label: "Learn More", to: "partner" },
      tone: "charcoal",
      image: ref("duo-partner"),
    },
  ],
} satisfies DocSeed<"home.duo">;

export const homeManifestoSeed = {
  media: ref("manifesto"),
  ctas: [
    { label: "Donate", to: "donate" },
    { label: "Tell Your Story", to: "tellStory" },
  ],
} satisfies DocSeed<"home.manifesto">;

export const homeImpactSeed = {
  title: ["Our", "Impact", "in Action"],
  text: "Haven supports children, caregivers and communities through education, healthcare, counselling and protection.",
  placeholderNote: "Figures shown are placeholders pending verified programme data.",
  cards: [
    { statId: "children-supported", tone: "clay" },
    { statId: "families-reached", tone: "marigold" },
    { statId: "counselling-sessions", tone: "cocoa" },
  ],
} satisfies DocSeed<"home.impact">;

// Client brief: the child is always the one being helped; no school crests (Haven does not run a school).
export const homeFocusSeed = {
  slides: [
    { id: "protection", word: "Protection", caption: "Trained caseworkers listen to children at eye level and help keep them safe.", media: ref("focus-1") },
    { id: "education", word: "Education", caption: "We help children get to school, with fees, books and bags for the road ahead.", media: ref("focus-2") },
    { id: "healing", word: "Healing", caption: "Counsellors, nurses and doctors come to the children, checking on them where they are.", media: ref("focus-3") },
    { id: "justice", word: "Justice", caption: "Police officers visit schools so children know the law is there to protect them.", media: ref("focus-4") },
  ],
} satisfies DocSeed<"home.focus">;

export const homeAppealsSeed = {
  eyebrow: "Let’s Start Giving",
  titleLines: ["See Your Impact: Transparent", "Programme Appeals"],
  intro: "From Ramadan and Eid to Christmas and Thanksgiving, give in the season that matters to you, in The Gambia and beyond.",
  placeholderNote: "Appeal figures are illustrative until confirmed by the finance team.",
  groups: [
    { id: "ramadan-eid", label: "Ramadan & Eid" },
    { id: "christmas", label: "Christmas" },
    { id: "thanksgiving", label: "Thanksgiving" },
    { id: "year-round", label: "Year-round" },
  ],
} satisfies DocSeed<"home.appeals">;

export const homeDonateSeed = {
  title: ["Give Hope,", "Create", "Opportunity"],
  text: "Your contribution can help a vulnerable child return to school, access medical care, receive counselling or obtain essential protection and family support.",
  media: ref("donate"),
  anywhereLabel: "Where it’s needed most",
  securityNote: "We never store card details on this site.",
  thankYouCash: "Our team will contact you with the approved payment method and send a receipt once your gift is received.",
  thankYouKind: "Our team will follow up to arrange drop-off or collection of your items.",
  updatesConsentLabel: "Yes, send me approved impact updates about how my gift helps.",
  anonymousLabel: "Keep my gift anonymous in any public recognition.",
} satisfies DocSeed<"home.donate">;

export const homeDoorsSeed = {
  title: "You Do Not Have to Face It Alone",
  text: "Whether you are a child, parent, caregiver, teacher or community member, you can ask for help or refer a vulnerable child through a confidential request.",
  primaryCta: { label: "Request Support", to: "support" },
  secondaryCta: { label: "Report a Concern", to: "report" },
} satisfies DocSeed<"home.doors">;

export const homeStoriesSeed = {
  title: ["Stories of", "Hope"],
  intro: "Real change from families and communities across Africa, Asia and the Arab world, shared with consent and with every child’s privacy protected.",
  ctas: [
    { label: "Tell Your Story", to: "tellStory" },
    { label: "See All Stories", to: "stories" },
  ],
} satisfies DocSeed<"home.stories">;

export const homeFounderSeed = {
  eyebrow: "A Word From Our Founder",
  titleLines: ["Lasting Change,", "Built Around", "Every Child"],
  text: "Our approach combines direct assistance with family support, referrals, advocacy, community education and responsible partnerships, because lasting change is built together.",
  quoteName: "Emanuel", // CLIENT: confirm name + title
  quoteRole: "Founder, Haven",
  quote: "Every child we meet reminds us why dignity, safety and opportunity can never be optional.",
  image: ref("founder"),
  cta: { label: "Our Story", to: "about" },
} satisfies DocSeed<"home.founder">;

export const homeTeamSeed = {
  eyebrow: "Our Team",
  lines: ["Meet the People Behind Haven"],
} satisfies DocSeed<"home.team">;

export const homeRestoringSeed = {
  titleLines: ["We Always Stand With", "Children and Families"],
  text: "Discover how children and communities are being transformed through protection, education, healthcare and counselling, and the real-life impact of every contribution.",
  statIds: ["active-volunteers", "community-partners", "monthly-donors", "school-fee-interventions"],
  image: ref("restoring-bw"),
  film: ref("film"),
  filmTitle: "Haven: our story",
  placeholderNote: "Placeholder figures — to be replaced with verified data.",
} satisfies DocSeed<"home.restoring">;

export const homeTestimonialsSeed = {
  eyebrow: "Testimonials",
  lines: ["What People Say About", "Our Work"],
} satisfies DocSeed<"home.testimonials">;

// The founder's real process (client meeting 2026-09-28): we go out, build relationships with
// orphanages in person, verify what we cannot yet visit, identify needs, then give and follow up.
export const homeJourneySeed = {
  title: "How We Reach Every Child",
  text: "We go to children rather than wait for them to find us, and where we cannot travel yet, we verify before we give. Families can also reach us directly and confidentially.",
  steps: [
    { id: "go-out", title: "We Go Out", text: "Our team travels into communities to find families and children who need support.", image: ref("journey-outreach") },
    { id: "relationships", title: "We Build Relationships", text: "We visit orphanages in person, meet directors, ustaz and teachers, and stay in touch.", image: ref("journey-orphanage") },
    { id: "verify", title: "We Verify", text: "Where we cannot travel yet, we contact the organisation, build trust and confirm it is authentic before giving.", image: ref("journey-verify") },
    { id: "needs", title: "We Identify Needs", text: "Together we work out what each child and each home actually needs.", image: ref("journey-needs") },
    { id: "give", title: "We Give & Follow Up", text: "Donations, supplies and referrals continue, followed up until we can visit in person.", image: ref("journey-give") },
  ],
} satisfies DocSeed<"home.journey">;

export const homeProjectsSeed = {
  eyebrow: "Recent Projects",
  lines: ["Our Recent Projects"],
  cta: { label: "View All Projects", to: "projects" },
  featured: ["back-to-school-drive", "reading-circles", "community-health-days"],
} satisfies DocSeed<"home.projects">;

export const homeFaqSeed = {
  eyebrow: "Frequently Asked Questions",
  lines: ["Have Any Questions For Us?"],
  media: { main: ref("faq-main"), inset: ref("faq-bw"), heart: ref("faq-heart") },
} satisfies DocSeed<"home.faq">;

export const homeJoinSeed = {
  title: ["Join the", "Haven", "Family"],
  text: "A monthly impact update, volunteer calls and stories of hope, straight to your inbox.",
  media: ref("join"),
  note: "We only send approved updates. Unsubscribe any time.",
} satisfies DocSeed<"home.join">;

export const homeNewsSeed = {
  eyebrow: "News & Resources",
  lines: ["Our Latest News & Articles"],
  intro: "Fresh impact updates and stories of hope, published every month.",
  cardCta: "Read More",
  featured: [],
} satisfies DocSeed<"home.news">;

// D128: the spec's closing band (ToR §3), built and seeded hidden so the approved landing stays
// pixel-identical. Switching it on is an owner question (PLAN §8 q1).
export const homeFinalCtaSeed = {
  visible: false,
  title: "Your Support Will Positively Impact a Child's Welfare and Future.",
  buttons: [
    { label: "Donate Now", to: "donate" },
    { label: "Become a Volunteer", to: "volunteer" },
    { label: "Request Support", to: "support" },
  ],
} satisfies DocSeed<"home.finalCta">;
