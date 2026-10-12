// The team (content-model §3.5, PLAN D50). Verbatim from content/people.ts → team, in today's order.
// CLIENT: team members and biographies (ToR §18). Names, roles and links below are placeholders;
// portraits are illustrative AI images. Never add personal phone numbers or emails here.

import "server-only";

import type { ItemSeed } from "@/lib/content/types";
import { ref } from "@/lib/media/pipeline";

// Each member's own profiles; the card's ＋ fans these out. CLIENT: real links per member.
const socials = () =>
  [
    { icon: "facebook", href: "#" },
    { icon: "instagram", href: "#" },
    { icon: "tiktok", href: "#" },
    { icon: "linkedin", href: "#" },
  ] as const satisfies ReadonlyArray<{ icon: string; href: string }>;

type Bio = { bio: string[]; languages: string[] };

const member = (id: string, order: number, name: string, role: string, image: string, about: Bio): ItemSeed<"team"> => ({
  id,
  placeholder: true,
  order,
  name,
  role,
  bio: about.bio.map((text, i) => ({ id: `${id}-b${i + 1}`, type: "paragraph" as const, text })),
  languages: about.languages,
  image: ref(image),
  socials: socials().map((s) => ({ ...s })),
  showOn: ["home", "about"],
});

// CLIENT: biographies and languages are [draft] placeholders for the About page's team drawer
// (public-pages §3.2.7, PLAN D50). Two to four sentences each; no personal phone numbers or emails.
export const teamSeeds: ItemSeed<"team">[] = [
  member("team-1", 1, "Awa Jallow", "Programme Officer", "team-1", {
    bio: [
      "Awa looks after Haven's education and family programmes, from the first conversation with a family to the follow-up visit each term.",
      "She has spent more than ten years working with schools and community groups, and makes sure every request is reviewed fairly and with care.",
    ],
    languages: ["English", "Mandinka", "Wolof"],
  }),
  member("team-2", 2, "Arjun Mehta", "Volunteer Coordinator", "team-2", {
    bio: [
      "Arjun welcomes and supports Haven's volunteers, matching each person's skills with the place they can help most.",
      "He organises training, safe-recruitment checks and outreach days, and keeps volunteers in touch wherever they are in the world.",
    ],
    languages: ["English", "Hindi", "Gujarati"],
  }),
  member("team-3", 3, "Ayesha Malik", "Counsellor", "team-3", {
    bio: [
      "Ayesha is a qualified counsellor who supports children and caregivers through loss, upheaval and difficult times, in person and by video.",
      "She believes every child deserves a safe space to be heard, and works closely with specialists when more help is needed.",
    ],
    languages: ["English", "Urdu", "Arabic"],
  }),
  member("team-4", 4, "Ebrima Touray", "Legal Referral Lead", "team-4", {
    bio: [
      "Ebrima helps families understand their options on matters such as guardianship, documents and child rights.",
      "He builds Haven's network of approved legal professionals and makes sure every referral is followed up.",
    ],
    languages: ["English", "Mandinka", "Fula"],
  }),
  member("team-5", 5, "Maria Santos", "Safeguarding Officer", "team-5", {
    bio: [
      "Maria leads Haven's safeguarding work: reviewing concerns, training staff and volunteers, and working with protection services when a child needs them.",
      "She makes sure every child-protection report is handled quickly, confidentially and with the child's best interests first.",
    ],
    languages: ["English", "Portuguese", "Spanish"],
  }),
  member("team-6", 6, "Yousef Haddad", "Community Outreach", "team-6", {
    bio: [
      "Yousef visits communities, schools and children's homes to listen first and understand what families really need.",
      "He builds the local relationships that help Haven reach children early and confirm that every partner is genuine.",
    ],
    languages: ["English", "Arabic", "French"],
  }),
];
