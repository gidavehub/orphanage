// Projects (PLAN D50, D132). The three landing projects verbatim from content/home.ts → projects.items
// (title, subtitle, image), in today's order, with slugs.
// CLIENT: places (country only), dates, galleries and the story text are placeholders until the
// programme team confirms them. They describe how each kind of project works (CLIENT-SPEC §3, §5)
// without names, exact places or figures. No outcomes are listed: only verified outcomes render
// publicly, and none is verified yet. Gallery pictures are illustrative pipeline media (D54).

import "server-only";

import type { ItemSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

const DAY = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 9, 0, 0);

export const projectSeeds: ItemSeed<"projects">[] = [
  {
    id: "back-to-school-drive",
    placeholder: true,
    slug: "back-to-school-drive",
    order: 1,
    title: "Back-to-School Drive",
    subtitle: "Education Assistance",
    programmeId: "education",
    place: "gm", // CLIENT
    status: "completed",
    startedAt: DAY(2026, 8, 3), // CLIENT
    endedAt: DAY(2026, 9, 18), // CLIENT
    image: ref("project-1"),
    summary: "School fees, uniforms and books so that children could start the new school year.",
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "Before the new school year, our team worked with families and schools to cover fees, uniforms and learning materials for children whose education was at risk.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "The weeks before term are when many families have to choose between school costs and food on the table. The drive brought those costs together into one simple package, agreed with each school, so that no child had to stay at home on the first day.",
      },
      { id: "b3", type: "heading", level: 2, text: "What the drive covered" },
      {
        id: "b4",
        type: "list",
        style: "bullet",
        items: [
          "School fees, paid directly to each school against an invoice.",
          "Uniforms and school shoes.",
          "Exercise books, pens and school bags.",
          "Follow-up visits through the first term to check attendance.",
        ],
      },
      { id: "b5", type: "heading", level: 2, text: "How children were chosen" },
      {
        id: "b6",
        type: "paragraph",
        text: "Families were referred by partner schools, community volunteers and our own [support request form](/get-support/request?type=education). A caseworker visited each family and confirmed the need with the school before any payment was made.",
      },
      {
        id: "b7",
        type: "callout",
        tone: "warm",
        title: "Keeping it going",
        text: "The next drive is funded through Keep Children in School. Every gift goes to fees, uniforms and books, and you can see where the money goes before you give.",
      },
    ],
    gallery: [ref("news-1"), ref("about"), ref("focus-2")], // CLIENT
    causeSlug: "keep-children-in-school",
    seo: {},
  },
  {
    id: "reading-circles",
    placeholder: true,
    slug: "reading-circles",
    order: 2,
    title: "Reading Circles",
    subtitle: "Learning Resources",
    programmeId: "education",
    place: "in", // CLIENT
    status: "ongoing",
    startedAt: DAY(2026, 2, 2), // CLIENT
    image: ref("project-2"),
    summary: "Volunteer-led reading sessions that turn borrowed classrooms into places where children love to read.",
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "Volunteer teachers run reading circles after school, with donated books and a warm, safe place to read together.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "Many children we support are the first in their family to go to school. At home there may be no books and no quiet corner to read in. Reading circles give them both, a few afternoons a week, with an adult who has time to listen.",
      },
      { id: "b3", type: "heading", level: 2, text: "How a reading circle works" },
      {
        id: "b4",
        type: "list",
        style: "number",
        items: [
          "A partner school or community centre lends a classroom after lessons.",
          "Trained volunteers, checked under our safeguarding policy, lead small groups by age and level.",
          "Children borrow books to take home and read with their families.",
          "Volunteers share progress with the school, so teachers can help where a child struggles.",
        ],
      },
      {
        id: "b5",
        type: "callout",
        tone: "safeguarding",
        title: "Safe by design",
        text: "Every volunteer is vetted and trained before working with children, sessions are always held in open, shared spaces, and no volunteer is ever alone with a child.",
      },
      {
        id: "b6",
        type: "paragraph",
        text: "Reading circles are running now and always need volunteers and books. If you can give an afternoon a week, we would love to [hear from you](/get-involved/volunteer).",
      },
    ],
    gallery: [ref("appeal-education"), ref("journey-needs")], // CLIENT
    seo: {},
  },
  {
    id: "community-health-days",
    placeholder: true,
    slug: "community-health-days",
    order: 3,
    title: "Community Health Days",
    subtitle: "Medical Support",
    programmeId: "medical",
    place: "id", // CLIENT
    status: "completed",
    startedAt: DAY(2026, 7, 6), // CLIENT
    endedAt: DAY(2026, 8, 1), // CLIENT
    image: ref("project-3"),
    summary: "Health days with partner nurses and doctors, connecting children with checks and follow-up care.",
    body: [
      {
        id: "b1",
        type: "paragraph",
        text: "Partner nurses and doctors set up health days in the community, so that children could have check-ups and be referred for follow-up care.",
      },
      {
        id: "b2",
        type: "paragraph",
        text: "For a family far from a clinic, a check-up can cost a day's income and a long journey. Health days bring the clinic to them: a school yard or community hall, a few tables, and partner professionals who give their day.",
      },
      { id: "b3", type: "heading", level: 2, text: "On the day" },
      {
        id: "b4",
        type: "list",
        style: "bullet",
        items: [
          "General check-ups, with height, weight and nutrition checks.",
          "Eye and hearing screening where partners could offer it.",
          "Health advice for parents and carers.",
          "Referrals to partner clinics and hospitals for follow-up care.",
        ],
      },
      { id: "b5", type: "heading", level: 2, text: "Following up" },
      {
        id: "b6",
        type: "paragraph",
        text: "Where a child needed treatment, our medical support programme helped with transport, consultation fees and medicines, and our team stayed in touch with the family until the care was complete.",
      },
    ],
    gallery: [ref("news-3"), ref("appeal-medical"), ref("story-5")], // CLIENT
    causeSlug: "medical-fund",
    seo: {},
  },
];
