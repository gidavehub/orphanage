// The six programmes (content-model §8, PLAN D40–D41). Card copy verbatim from content/programmes.ts;
// nav blurbs from content/nav.ts; service lists verbatim from the ToR §5 (docs/CLIENT-SPEC.md);
// problem, eligibility and process copy from public-pages §3.4 [draft]. Every invented sentence is
// CLIENT copy: the records stay `placeholder: true` until Haven approves them (ToR §18).
// Ids, slugs and icons are fixed in code; staff can hide a programme but not add or remove one.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

const P = (id: string, text: string) => ({ id, type: "paragraph" as const, text });

const SHARED_ELIGIBILITY =
  "Children and families facing hardship in the communities we serve, or referred through a verified partner organisation.";

export const programmeSeeds: ItemSeed<"programmes">[] = [
  {
    id: "protection",
    placeholder: true,
    slug: "child-protection",
    order: 1,
    title: "Child Protection",
    fullTitle: "Child Protection & Abuse Prevention",
    headline: "Protecting Children From Harm",
    summary:
      "We promote safe environments for children and provide channels for reporting concerns, seeking guidance and accessing appropriate support.",
    navBlurb: "Safe environments & confidential reporting",
    hero: { eyebrow: "Child Protection & Abuse Prevention", media: ref("news-2") },
    image: ref("news-2"),
    // CLIENT
    overview: [
      P(
        "o1",
        "Every child has the right to be safe. Haven helps families, schools and communities recognise harm early, gives people a confidential way to raise a concern, and connects children with qualified protection services.",
      ),
    ],
    problem: {
      heading: "Why this matters",
      body: [
        P(
          "p1",
          "Many children face harm, neglect or exploitation without a safe adult to tell or a clear route to help. Families and communities often don't know where to report a concern or what happens next.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Multidisciplinary safeguarding and coordinated statutory response" },
        { title: "Awareness" },
        { title: "Confidential concern reporting" },
        { title: "Initial screening" },
        { title: "Referral to protection services" },
        { title: "Safeguarding resources" },
        { title: "Parent and community education" },
        { title: "Policies for partner institutions" },
        { title: "Legal and psychosocial referrals" },
      ],
    },
    eligibility: {
      heading: "Who can ask",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Anyone may report a concern about a child. There is no eligibility test.",
          "Parents, caregivers, teachers, neighbours, professionals and children themselves.",
          "Schools, clinics and children's homes that want help with their safeguarding.",
        ],
        whatWeAsk: [
          "Only what you know. You don't need proof, and you can report anonymously.",
          "What happened, when, and where the child is now, as far as you know.",
          "A way to reach you, only if you are happy for us to follow up.",
        ],
      },
      note: "This platform is not an emergency-response service.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Tell us securely", text: "Use the confidential concern form. Your report goes only to authorised safeguarding staff." },
        { title: "Safeguarding review", text: "Authorised safeguarding staff review the report and give it a risk level." },
        { title: "Urgent cases escalated", text: "Anything urgent is escalated straight away." },
        { title: "Referral", text: "We refer to protection services or the authorities where needed." },
        { title: "Follow-up recorded", text: "Every action and follow-up is recorded." },
      ],
    },
    requestCta: { label: "Report a Concern", text: "Worried about a child's safety? Tell our safeguarding team in confidence.", category: "child_protection" },
    donateCta: { label: "Support This Programme", text: "Help keep children safe through awareness, screening and referrals.", causeSlug: "child-protection" },
    partnerCta: { label: "Partner With Us", text: "Schools, clinics and organisations can strengthen their safeguarding with us." },
    resourceCategories: ["child_safeguarding", "child_rights"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-6"],
    faqIds: ["faq-emergency", "faq-anonymous", "faq-after-concern", "faq-privacy"],
    contact: { team: "Safeguarding team", email: "safeguarding@haven.org.gm" }, // CLIENT
    notices: [{ kind: "emergency", text: "This platform is not an emergency-response service.", showOnCard: true }],
    seo: {},
  },
  {
    id: "education",
    placeholder: true,
    slug: "education",
    order: 2,
    title: "Education Assistance",
    fullTitle: "Education & School-Fee Assistance",
    headline: "Keeping Children in School",
    summary:
      "We help vulnerable children access educational opportunities through school-fee assistance, learning materials and related support.",
    navBlurb: "School fees, uniforms & materials",
    hero: { eyebrow: "Education & School-Fee Assistance", media: ref("appeal-education") },
    image: ref("appeal-education"),
    // CLIENT
    overview: [
      P(
        "o1",
        "When fees, uniforms or books are out of reach, children fall behind or leave school altogether. Haven works with families, schools and partners so that cost is never the reason a child stops learning.",
      ),
    ],
    problem: {
      heading: "Why children leave school",
      body: [
        P(
          "p1",
          "School fees, uniforms, books and the cost of getting to class keep many children out of school, or force them to leave early. Each missed term makes it harder to return.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Tuition and fee assistance" },
        { title: "Hygiene products" },
        { title: "Nutrition" },
        { title: "Bedding" },
        { title: "Uniforms and materials" },
        { title: "Learning resources" },
        { title: "Educational referrals" },
        { title: "School readiness" },
        { title: "Partner sponsorship" },
      ],
    },
    eligibility: {
      heading: "Who can apply",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Children aged roughly 4 to 18 who are enrolled in school or ready to start.",
          "Children whose schooling is at risk because of the family's circumstances.",
          "Parents, caregivers, teachers or partners can ask on a child's behalf.",
        ],
        whatWeAsk: [
          "The child's age, school and what they need, such as fees, uniforms or books.",
          "Later, a fee letter or invoice from the school.",
          "Proof that the child is enrolled.",
        ],
      },
      note: "Applications are assessed against eligibility, and submitting one does not guarantee approval.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Apply", text: "A parent, caregiver, teacher or community member submits a confidential request." },
        { title: "Review and verification", text: "We check the request against policy, resources and safeguarding procedures, and confirm details with the family and school." },
        { title: "Decision", text: "We let you know the outcome. Submitting a request does not guarantee approval." },
        { title: "Support delivered", text: "Fees are paid directly to the school where possible." },
        { title: "Follow-up each term", text: "We stay in touch to see how the child is getting on." },
      ],
    },
    requestCta: { label: "Request Education Support", text: "Tell us about the child and what they need.", category: "education" },
    donateCta: { label: "Keep a Child in School", text: "Fund fees, uniforms and books for a term.", causeSlug: "education" },
    partnerCta: { label: "Sponsor a Programme", text: "Schools, businesses and foundations can sponsor places." },
    resourceCategories: ["education"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-1", "story-3"],
    faqIds: ["faq-guarantee", "faq-after-request", "faq-who-can-ask"],
    contact: { team: "Education team", email: "education@haven.org.gm" }, // CLIENT
    notices: [{ kind: "eligibility", text: "Applications are assessed against eligibility, and submitting one does not guarantee approval." }],
    seo: {},
  },
  {
    id: "medical",
    placeholder: true,
    slug: "medical",
    order: 3,
    title: "Medical Support",
    fullTitle: "Medical Assistance",
    headline: "Connecting Children With Essential Healthcare",
    summary:
      "We connect children and families with appropriate healthcare information, services and assistance based on assessed needs.",
    navBlurb: "Referrals & treatment support",
    hero: { eyebrow: "Medical Assistance", media: ref("appeal-medical") },
    image: ref("appeal-medical"),
    // CLIENT
    overview: [
      P(
        "o1",
        "Haven helps children reach the care they need: a referral to the right clinic, help with treatment costs and supplies, and follow-up so that care continues.",
      ),
    ],
    problem: {
      heading: "Why this matters",
      body: [
        P(
          "p1",
          "When a child falls ill, families can struggle to reach the right clinic, afford treatment or keep up with follow-up care.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Medical referrals" },
        { title: "Treatment-cost requests" },
        { title: "Health information" },
        { title: "Healthcare partners" },
        { title: "Medical-supply assistance" },
        { title: "Follow-up" },
      ],
    },
    eligibility: {
      heading: "Who can ask",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Children and families who need help reaching or paying for healthcare.",
          "Caregivers who need guidance on where to find the right clinic or specialist.",
        ],
        whatWeAsk: [
          "A short description of the child's health need, in your own words.",
          "A referral or diagnosis from a qualified professional, where one exists.",
          "A cost estimate for the treatment.",
        ],
      },
      note: "We do not provide medical diagnoses or replace professional medical advice.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Request", text: "Tell us what the child needs through a confidential request." },
        { title: "Review", text: "We may ask for documents. We never diagnose." },
        { title: "Referral or decision", text: "We refer to a healthcare partner or decide on help with treatment costs." },
        { title: "Support", text: "Payment goes to the provider, or we supply what is needed." },
        { title: "Follow-up", text: "We check in to make sure care continues." },
      ],
    },
    requestCta: { label: "Request Medical Support", text: "Tell us what care the child needs.", category: "medical" },
    donateCta: { label: "Support This Programme", text: "Help children reach treatment, medicines and follow-up care.", causeSlug: "medical" },
    partnerCta: { label: "Become a Healthcare Partner", text: "Clinics and health professionals can take referrals from us." },
    resourceCategories: ["medical_information"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-5", "story-8"],
    faqIds: ["faq-guarantee", "faq-after-request", "faq-privacy"],
    contact: { team: "Medical support team", email: "medical@haven.org.gm" }, // CLIENT
    notices: [{ kind: "medical", text: "We do not provide medical diagnoses or replace professional medical advice.", showOnCard: true }],
    seo: {},
  },
  {
    id: "psychological",
    placeholder: true,
    slug: "counselling",
    order: 4,
    title: "Psychological Support",
    fullTitle: "Psychological & Counselling Support",
    headline: "A Safe Space to Be Heard",
    summary:
      "We facilitate counselling, psychosocial support and referrals to qualified professionals for children and families facing emotional difficulties.",
    navBlurb: "Counselling & psychosocial care",
    hero: { eyebrow: "Psychological & Counselling Support", media: ref("appeal-counselling") },
    image: ref("appeal-counselling"),
    // CLIENT
    overview: [
      P(
        "o1",
        "Haven connects children and caregivers with qualified counsellors, in person or by video, and with referrals when more specialised care is needed.",
      ),
    ],
    problem: {
      heading: "Why this matters",
      body: [
        P(
          "p1",
          "Loss, violence, poverty and upheaval can leave children and caregivers carrying deep distress, with few safe places to talk to someone qualified.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Counselling request form" },
        { title: "Appointment scheduling" },
        { title: "Video sessions with a link sent by email" },
        { title: "Referral to approved professionals" },
        { title: "Follow-up" },
        { title: "Mental-health resources" },
      ],
    },
    eligibility: {
      heading: "Who can ask",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Anyone can ask, including young people.",
          "Parents and caregivers who are worried about a child's wellbeing, or their own.",
        ],
        whatWeAsk: [
          "No documents are needed.",
          "A little about what's been happening, and how you'd prefer to meet: in person or by video.",
        ],
      },
      note: "Assessments are made only by qualified professionals. There are no automated diagnoses.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Request", text: "Ask for counselling through a confidential request." },
        { title: "Matched with a counsellor", text: "We match you with a qualified counsellor." },
        { title: "Appointment confirmed", text: "In person or by video; the link is sent by email." },
        { title: "Sessions", text: "Sessions go ahead at a time that suits you." },
        { title: "Follow-up or referral", text: "We follow up, or refer you to more specialised care." },
      ],
    },
    requestCta: { label: "Request Counselling", text: "Ask for a confidential session with a qualified counsellor.", category: "counselling" },
    donateCta: { label: "Support This Programme", text: "Fund counselling sessions for children and caregivers.", causeSlug: "counselling" },
    partnerCta: { label: "Partner With Us", text: "Counsellors and organisations can join our referral network." },
    resourceCategories: ["mental_health"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-4"],
    faqIds: ["faq-privacy", "faq-who-can-ask", "faq-after-request"],
    contact: { team: "Counselling team", email: "counselling@haven.org.gm" }, // CLIENT
    notices: [{ kind: "assessment", text: "Assessments are made only by qualified professionals. There are no automated diagnoses." }],
    seo: {},
  },
  {
    id: "legal",
    placeholder: true,
    slug: "legal",
    order: 5,
    title: "Legal Support",
    fullTitle: "Legal Support & Referral",
    headline: "Helping Families Understand Their Options",
    summary: "We provide information and referral pathways for child-protection matters requiring professional legal assistance.",
    navBlurb: "Information & legal referrals",
    hero: { eyebrow: "Legal Support & Referral", media: ref("journey-verify") },
    image: ref("journey-verify"),
    // CLIENT
    overview: [
      P(
        "o1",
        "Haven helps families understand their options on matters that affect a child, and refers them to approved legal professionals when they need advice.",
      ),
    ],
    problem: {
      heading: "Why this matters",
      body: [
        P(
          "p1",
          "Families caring for vulnerable children often face questions about guardianship, documents, inheritance or abuse, without knowing their rights or where to turn.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Legal-support request form" },
        { title: "Referral to approved legal professionals" },
        { title: "Child-rights information" },
        { title: "Case follow-up" },
        { title: "Secure document submission" },
      ],
    },
    eligibility: {
      heading: "Who can ask",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Families and caregivers facing a legal question that affects a child.",
          "Questions about guardianship, birth registration, inheritance, custody or abuse.",
        ],
        whatWeAsk: [
          "A short description of the situation and what you'd like to understand.",
          "Documents only if they are relevant, uploaded securely.",
        ],
      },
      note: "General website information is not legal advice.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Request", text: "Tell us about the situation through a confidential request." },
        { title: "Review", text: "We review the request and what kind of help is needed." },
        { title: "Information and referral", text: "We share information and refer you to an approved legal professional." },
        { title: "Secure document support", text: "We help you share documents safely." },
        { title: "Follow-up", text: "We follow up to see how things are going." },
      ],
    },
    requestCta: { label: "Request Legal Support", text: "Tell us what you need help understanding.", category: "legal" },
    donateCta: { label: "Support This Programme", text: "Help families get the legal information and referrals they need.", causeSlug: "legal" },
    partnerCta: { label: "Join Our Legal Network", text: "Legal practices can take referrals from us." },
    resourceCategories: ["legal_information", "child_rights"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-7"],
    faqIds: ["faq-privacy", "faq-after-request", "faq-guarantee"],
    contact: { team: "Legal support team", email: "legal@haven.org.gm" }, // CLIENT
    notices: [{ kind: "legal", text: "General website information is not legal advice.", showOnCard: true }],
    seo: {},
  },
  {
    id: "family",
    placeholder: true,
    slug: "family-community",
    order: 6,
    title: "Family & Community",
    fullTitle: "Family & Community Support",
    headline: "Strengthening the World Around the Child",
    summary:
      "We address the wider circumstances affecting children through referrals, family guidance, community engagement and material assistance.",
    navBlurb: "Guidance, outreach & material help",
    hero: { eyebrow: "Family & Community Support", media: ref("journey-needs") },
    image: ref("journey-needs"),
    // CLIENT
    overview: [
      P(
        "o1",
        "A child's wellbeing depends on the people and places around them. Haven supports families with guidance, referrals and practical help, and works with communities so children grow up supported.",
      ),
    ],
    problem: {
      heading: "Why this matters",
      body: [
        P(
          "p1",
          "A child's wellbeing depends on the home and community around them. Hunger, unstable income and isolation put whole families under strain.",
        ),
      ],
      facts: [],
    },
    support: {
      heading: "Support we can provide",
      items: [
        { title: "Referrals" },
        { title: "Family guidance" },
        { title: "Community engagement" },
        { title: "Material assistance (food, bedding, essentials)" },
      ],
    },
    eligibility: {
      heading: "Who can ask",
      intro: SHARED_ELIGIBILITY,
      criteria: {
        who: [
          "Families caring for children through a difficult time.",
          "Households facing hunger, unstable income, illness or isolation.",
          "Community groups and partners referring a family they know.",
        ],
        whatWeAsk: [
          "A short description of the family's situation and needs.",
          "How many children live in the home, and their ages.",
        ],
      },
      note: "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support.",
    },
    process: {
      heading: "How it works",
      steps: [
        { title: "Reach out", text: "Tell us about your family through a confidential request." },
        { title: "We assess together", text: "We work out the family's needs together." },
        { title: "Plan", text: "We agree a plan that fits the family." },
        { title: "Help", text: "Guidance, referrals or material help." },
        { title: "Follow-up", text: "We stay in touch to see how things are going." },
      ],
    },
    requestCta: { label: "Request Family Support", text: "Tell us what your family needs.", category: "family_support" },
    donateCta: { label: "Support This Programme", text: "Provide food, bedding and essentials for families in hardship.", causeSlug: "family-community" },
    partnerCta: { label: "Partner With Us", text: "Community groups and organisations can work alongside us." },
    resourceCategories: ["parenting"],
    relatedResourceIds: [],
    relatedStoryIds: ["story-2"],
    faqIds: ["faq-guarantee", "faq-in-kind", "faq-where-money-goes"],
    contact: { team: "Family support team", email: "family@haven.org.gm" }, // CLIENT
    notices: [],
    seo: {},
  },
];
