// pages.about (public-pages §3.2). [spec] copy is quoted from docs/CLIENT-SPEC.md §4 verbatim;
// [draft] copy is ours and marked CLIENT.

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { items, para, type PageSeed } from "./_helpers";

export const aboutPage: PageSeed = {
  hero: {
    eyebrow: "About Haven",
    title: ["Who We Are"],
    intro: "A non-profit protecting vulnerable children and supporting families in very difficult circumstances.",
    media: ref("hero-1"),
  },
  seo: {
    title: "About Us",
    description:
      "Haven protects vulnerable children and strengthens families by connecting them with education, healthcare, counselling, legal assistance and community-based support.",
  },
  sections: {
    whoWeAre: {
      title: ["Restoring Hope", "One Child at a Time"],
      body: [
        para(
          "w1",
          "Haven works with communities, professionals, donors and partners, connecting families to education, healthcare, counselling, economic inclusion and legal assistance. Our approach strengthens the environment around the child through direct assistance, family support, referrals, advocacy, community education and partnerships.",
        ),
        para(
          "w2",
          "Haven brings individuals, professionals, organisations and communities together to provide practical and sustainable assistance, helping children and families build safer, healthier and more hopeful futures. Rooted in The Gambia, we reach out to children and families wherever the need is.",
        ),
      ],
    },
    vision: {
      eyebrow: "Vision",
      body: [
        para("v1", "Societies that cultivate safe, dignified, and economically inclusive environments, empowering every child to thrive and reach their full potential."),
      ],
    },
    mission: {
      eyebrow: "Mission",
      body: [
        para(
          "m1",
          "To protect vulnerable children, enhance their economic prosperity, and strengthen families by connecting them with education, healthcare, psychosocial support, legal assistance and sustainable community-based opportunities.",
        ),
      ],
    },
    // CLIENT: value descriptions are [draft].
    values: {
      eyebrow: "What Guides Us",
      title: ["Our Values"],
      items: items([
        ["Child-centred", "Every decision starts with the child's safety, dignity and best interests."],
        ["Compassion", "We meet every child and family with kindness and without judgement."],
        ["Integrity", "We do what we say, and we say what we do."],
        ["Inclusion", "We help every child, whatever their nationality, race, religion, language or ability."],
        ["Accountability", "We are transparent about our work, our finances and our impact."],
        ["Collaboration", "Lasting change is built with communities, professionals and partners."],
        ["Confidentiality", "Personal stories and records are protected and shared only with consent."],
      ]),
    },
    approach: {
      eyebrow: "How We Work",
      title: ["How We Reach Every Child"],
    },
    team: {
      eyebrow: "Our Team",
      title: ["Meet the People Behind Haven"],
    },
    testimonials: {
      eyebrow: "Testimonials",
      title: ["What People Say About", "Our Work"],
      body: [para("t1", "Shared with permission.")],
    },
    partners: {
      eyebrow: "Our Partners",
      title: ["Working Together"],
      cta: { label: "Partner With Us", to: "partner" },
    },
    whereWeWork: {
      eyebrow: "Where We Work",
      title: ["Our Offices"],
    },
  },
};
