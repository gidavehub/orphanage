// Posts (content-model §7, PLAN D42–D43). The three landing news items verbatim from
// content/people.ts → news (title, image, date), published on today's dates.
// Category mapping (content-model §7.1): Education → programme-update for the education programme
// (shown as "Education"), Safeguarding → safeguarding, Partnerships → partnerships.
// CLIENT: placeholder articles. The excerpt and body describe how Haven works (CLIENT-SPEC §3, §5,
// §15) without inventing names, places or figures: every number is a statId from the stats registry,
// so it shows the "Illustrative" chip until a permitted person verifies it. They stay
// `placeholder: true` and are listed in the Before-launch checklist until real posts replace them.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

const AT_NINE = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 9, 0, 0);
const TEAM = { displayName: "Haven team" };

export const postSeeds: ItemSeed<"posts">[] = [
  {
    id: "back-to-school-50-children",
    placeholder: true,
    slug: "back-to-school-50-children",
    format: "article",
    title: "Back-to-School: 50 Children Return to Class",
    excerpt: "How families, schools and supporters came together so that children could start the new term in class.",
    cover: ref("news-1"),
    category: "programme-update",
    programmeIds: ["education"],
    causeSlugs: ["keep-children-in-school"],
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "As the new school year began, our education team worked with families and schools to cover fees, uniforms and books for children whose schooling was at risk.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "For many families, the start of term is the hardest month of the year. Fees fall due at the same time as uniforms, shoes and exercise books, and a child who misses the first weeks can quickly fall behind. Our aim is simple: no child should stay at home because of a bill their family cannot pay.",
      },
      { id: "b3", type: "heading", level: 2, text: "What a back-to-school grant covers" },
      {
        id: "b4",
        type: "list",
        style: "bullet",
        items: [
          "School fees, paid directly to the school against an invoice, never in cash.",
          "A uniform and a pair of school shoes.",
          "Exercise books, pens and a school bag.",
          "Help with transport where the walk to school is long or unsafe.",
        ],
      },
      { id: "b5", type: "stat", statId: "school-fee-interventions" },
      { id: "b6", type: "heading", level: 2, text: "How families are chosen" },
      {
        id: "b7",
        type: "paragraph",
        text: "Families ask for help through our [support request form](/get-support/request?type=education), a partner school or a community volunteer. A caseworker visits, listens and checks the need with the school before any payment is made. Priority goes to children who have lost a parent, children with a disability and families facing a sudden crisis.",
      },
      { id: "b8", type: "image", media: ref("project-1"), caption: "A back-to-school drive: fees, uniforms and books for the new term.", size: "inline" },
      { id: "b9", type: "heading", level: 2, text: "Staying in school, not just starting" },
      {
        id: "b10",
        type: "paragraph",
        text: "Starting the term is only the first step. Through the year our team keeps in touch with each family and school, follows attendance and steps in early when something changes at home, from a parent's illness to a lost income.",
      },
      {
        id: "b11",
        type: "callout",
        tone: "warm",
        title: "Every gift is accounted for",
        text: "Gifts to Keep Children in School pay for fees, uniforms and books. [Our Impact](/impact) shows how each year's donations were spent, programme by programme.",
      },
    ],
    author: TEAM,
    status: "published",
    publishedAt: AT_NINE(2026, 9, 12),
    readingMinutes: 2,
    seo: {},
  },
  {
    id: "keeping-every-childs-story-safe",
    placeholder: true,
    slug: "keeping-every-childs-story-safe",
    format: "article",
    title: "How We Keep Every Child’s Story Safe",
    excerpt: "Why we never publish children's names or exact locations, and how consent works before any story is shared.",
    cover: ref("news-2"),
    category: "safeguarding",
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "Every story we share is told with written consent, without children's full names and without precise locations. Our safeguarding team reviews each one before it is published.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "Stories help supporters see what their gifts make possible. They also carry a responsibility: a child's story belongs to the child and their family, and it must never put them at risk, today or in years to come.",
      },
      { id: "b3", type: "heading", level: 2, text: "Our rules for every story" },
      {
        id: "b4",
        type: "list",
        style: "number",
        items: [
          "Written consent from a parent or legal guardian before anything about a child is shared.",
          "No child's name, school name or exact location. We name the country only.",
          "No photograph that could identify a child without separate, written consent for that image.",
          "Families can withdraw their consent at any time, and we take the story down.",
          "A member of our safeguarding team reviews every story before it goes live.",
        ],
      },
      { id: "b5", type: "heading", level: 2, text: "Why some pictures are illustrative" },
      {
        id: "b6",
        type: "paragraph",
        text: "Many of the pictures on our website are illustrative images, and they are labelled as such. They show the kind of work we do without showing a real child who could be recognised. When we use a real photograph, it is with the consent of the people in it.",
      },
      {
        id: "b7",
        type: "callout",
        tone: "safeguarding",
        title: "Worried about a child?",
        text: "If you are worried about a child's safety, please don't wait. You can tell our safeguarding team in confidence through the [Report a Concern](/report-a-concern) page, and you can stay anonymous.",
      },
      { id: "b8", type: "heading", level: 2, text: "Sharing your own story" },
      {
        id: "b9",
        type: "paragraph",
        text: "If Haven has made a difference for you or your family, you can [share your story](/stories/share) with us. Our team reads every story and contacts you to check every word before anything is published.",
      },
    ],
    author: TEAM,
    status: "published",
    publishedAt: AT_NINE(2026, 8, 28),
    readingMinutes: 2,
    seo: {},
  },
  {
    id: "community-health-days",
    placeholder: true,
    slug: "community-health-days",
    format: "article",
    title: "Partner for Good: Community Health Days",
    excerpt: "Partner nurses and doctors brought check-ups and follow-up care closer to children and families.",
    cover: ref("news-3"),
    category: "partnerships",
    programmeIds: ["medical"],
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "Working with healthcare partners, we held community health days where children could be checked and referred for follow-up care.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "For families who live far from a clinic, a simple check-up can mean a day's lost income and a long journey. Health days bring partner nurses and doctors to a community centre or school yard for a day, so that children can be seen close to home.",
      },
      { id: "b3", type: "heading", level: 2, text: "What happens on a health day" },
      {
        id: "b4",
        type: "list",
        style: "bullet",
        items: [
          "General check-ups for children, with height, weight and nutrition checks.",
          "Eye and hearing screening where partners can offer it.",
          "Health advice for parents and carers.",
          "Referrals to partner clinics and hospitals for follow-up care.",
        ],
      },
      { id: "b5", type: "image", media: ref("project-3"), caption: "A community health day with partner nurses and doctors.", size: "inline" },
      { id: "b6", type: "heading", level: 2, text: "After the day" },
      {
        id: "b7",
        type: "paragraph",
        text: "A referral is only useful if a family can follow it. Where a child needs treatment, our medical support programme helps with transport, consultation fees and medicines, and our team stays in touch until the care is complete.",
      },
      { id: "b8", type: "stat", statId: "medical-cases" },
      {
        id: "b9",
        type: "paragraph",
        text: "Health days depend on partners who give their time and skills. If your clinic, hospital or professional association would like to work with us, we would love to [hear from you](/get-involved/partner).",
      },
    ],
    author: TEAM,
    status: "published",
    publishedAt: AT_NINE(2026, 8, 3),
    readingMinutes: 2,
    seo: {},
  },
];
